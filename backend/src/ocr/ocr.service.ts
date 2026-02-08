import { Injectable, OnModuleInit } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as path from 'path';
import * as fs from 'fs';

export interface OCRResult {
    text: string;
    confidence: number;
    data: {
        plateNumber?: string;
        materialType?: string;
        quantity?: string;
        unit?: string;
        supplierName?: string;
        ticketNumber?: string;
        date?: string;
    };
}

@Injectable()
export class OCRService implements OnModuleInit {
    private client: ImageAnnotatorClient;
    private usageFile = path.resolve('./vision-usage.json');
    private readonly FREE_TIER_LIMIT = 950; // 1000 sınırına yaklaşmadan dur

    async onModuleInit() {
        console.log('[OCRService] Initializing Google Vision API client...');
        let keyPath = path.resolve('./vision-credentials.json');

        if (!fs.existsSync(keyPath)) {
            console.warn('[OCRService] vision-credentials.json not found, falling back to google-credentials.json');
            keyPath = path.resolve('./google-credentials.json');
        }

        this.client = new ImageAnnotatorClient({
            keyFilename: keyPath,
        });

        console.log(`[OCRService] Google Vision API client ready (using ${path.basename(keyPath)})`);
        this.checkUsageFile();
    }

    async extractText(imageBuffer: Buffer): Promise<OCRResult> {
        // 1. KOTA KONTROLÜ
        this.checkAndIncrementUsage();

        try {
            // TEK ÇAĞRI (Maliyet Tasarrufu)
            const [result] = await this.client.textDetection(imageBuffer);
            const detections = result.textAnnotations;

            if (!detections || detections.length === 0) {
                console.log('[OCRService] No text detected');
                return { text: '', confidence: 0, data: {} };
            }

            const fullText = detections[0].description || '';

            // Güven skoru
            let totalConfidence = 0;
            let count = 0;
            for (let i = 1; i < detections.length; i++) {
                // @ts-ignore
                if (detections[i].confidence) {
                    // @ts-ignore
                    totalConfidence += detections[i].confidence;
                    count++;
                }
            }
            const confidence = count > 0 ? Math.round((totalConfidence / count) * 100) : 0;

            console.log('[OCRService] Raw OCR text:', fullText);

            // Veri çıkarma
            const extractedData = this.parseWaybillData(fullText);
            const validatedData = this.validateAndCorrect(extractedData);

            return {
                text: fullText,
                confidence: confidence,
                data: validatedData,
            };
        } catch (error) {
            console.error('[OCRService] OCR failed:', error);
            if (error.message.includes('Limit Reached')) {
                throw new Error('Google Vision API Monthly Limit Reached!');
            }
            throw new Error('OCR processing failed');
        }
    }

    // --- QUOTA TRACKING METHODS ---

    private checkUsageFile() {
        if (!fs.existsSync(this.usageFile)) {
            const initialData = { month: this.getCurrentMonth(), count: 0 };
            fs.writeFileSync(this.usageFile, JSON.stringify(initialData, null, 2));
        }
    }

    private getCurrentMonth(): string {
        const date = new Date();
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    private checkAndIncrementUsage() {
        try {
            this.checkUsageFile();
            const data = JSON.parse(fs.readFileSync(this.usageFile, 'utf8'));
            const currentMonth = this.getCurrentMonth();

            // Ay değiştiyse sayacı sıfırla
            if (data.month !== currentMonth) {
                data.month = currentMonth;
                data.count = 0;
            }

            if (data.count >= this.FREE_TIER_LIMIT) {
                throw new Error(`FREE TIER LIMIT EXCEEDED! Usage: ${data.count}/${this.FREE_TIER_LIMIT}`);
            }

            data.count++;
            fs.writeFileSync(this.usageFile, JSON.stringify(data, null, 2));
            console.log(`[OCRService] API Request Count for ${currentMonth}: ${data.count}`);

        } catch (error) {
            console.error('[OCRService] Usage tracking error:', error.message);
            if (error.message.includes('LIMIT EXCEEDED')) throw error;
        }
    }

    /**
     * İrsaliye verisini parse etme - V9 (Regex Overhaul)
     */
    private parseWaybillData(text: string): OCRResult['data'] {
        const data: OCRResult['data'] = {};
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // 1. PLAKA (Regex)
        const platePatterns = [
            /(?:PLAKA|PLATE|Arac)\s*(?:NO|NUMBER|NUM)?\s*[\.:]*\s*([0-9]{2}\s*[A-Z]{1,5}\s*[0-9]{2,5})/i,
            /\b([0-9]{2}[A-Z]{1,5}[0-9]{2,5})\b/i,
        ];

        for (const pattern of platePatterns) {
            const match = text.match(pattern);
            if (match) {
                let raw = match[1].replace(/\s+/g, '').toUpperCase();
                const standardMatch = raw.match(/^(\d{2})([A-Z]+)(\d+)$/);
                if (standardMatch) {
                    data.plateNumber = `${standardMatch[1]} ${standardMatch[2]} ${standardMatch[3]}`;
                } else {
                    data.plateNumber = raw;
                }
                break;
            }
        }

        // 2. MALZEME ve TEDARİKÇİ (Hibrit Analiz)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1] || '';

            // MALZEME
            // "9-MUHTELIF..." gibi satırları al, AMA içinde "Malzeme Adi" gibi etiketler varsa alma
            if (/^\d+[\s\-\.]+[A-Z\s]+(MALZEME|KUM|MICIR)/i.test(line) && !/(ADI|CINSI|TIP)/i.test(line)) {
                data.materialType = line.replace(/^\d+[\s\-\.]+/, '').trim();
            }
            // Klasik regex (Etiketi bul, yanına veya altına bak)
            else if (/(MALZEME|MATERIAL)\s*(ADI|CINS|TYPE)?/i.test(line)) {
                if (line.includes(':')) {
                    const parts = line.split(':');
                    if (parts[1] && parts[1].trim().length > 2) data.materialType = parts[1].trim();
                    else if (nextLine && !nextLine.includes('İrsaliye') && !/(MALZEME|ADI)/i.test(nextLine))
                        data.materialType = nextLine.replace(/^[:\.\s]+/, '').trim();
                } else if (nextLine.trim().startsWith(':')) { // Alt satır : ile başlıyorsa kesindir
                    data.materialType = nextLine.replace(/^[:\.\s]+/, '').trim();
                }
                // Alt satır düz metinse, ama etiket değilse al
                else if (nextLine && !/(İRSALİYE|NO|TARIH|Firma|ADI|CINSI)/i.test(nextLine) && nextLine.length > 3) {
                    // data.materialType = nextLine.trim(); // Bunu biraz riskli, columnar receipt'te yanlış satırı alabiliyor. 
                    // Columnar receipt için ": [Value]" yapısı daha güvenilir, onu fallback'e bırakalım.
                }
            }

            // FİRMA
            if (/(FİRMA|FIRMA|TEDARİKÇİ|SUPPLIER)\s*(ADI|NAME)?/i.test(line)) {
                if (line.includes(':')) {
                    const parts = line.split(':');
                    if (parts[1] && parts[1].trim().length > 2) data.supplierName = parts[1].trim();
                    else if (nextLine && !nextLine.includes('Malzeme')) data.supplierName = nextLine.replace(/^[:\.\s]+/, '').trim();
                } else if (nextLine.trim().startsWith(':')) {
                    data.supplierName = nextLine.replace(/^[:\.\s]+/, '').trim();
                } else if (nextLine && !/(MALZEME|ADRES|TEL)/i.test(nextLine)) {
                    data.supplierName = nextLine.trim();
                }
            }

            // FİŞ NO (Etiketli)
            if (/(FİŞ|FIS|NO|NUM)\s*[\.:]*\s*(\d+)$/i.test(line)) {
                const match = line.match(/(\d+)$/);
                if (match) data.ticketNumber = match[1];
            }
            // "NO" 9 (Ayrı satırlar)
            if (line.trim() === '9' && (lines[i - 1] && lines[i - 1].toUpperCase().includes('NO'))) {
                data.ticketNumber = '9';
            }
        }

        // B) Blok Analizi (Fallback)
        if (!data.supplierName) {
            const companyLine = lines.find(l =>
                /(\s+(LTD|STI|AS|A\.S|A\.Ş|MUHENDISLIK|PROJE|INSAAT|YAPI|SANAYI|TICARET))\b/i.test(l) &&
                !l.includes('Firma')
            );
            if (companyLine) data.supplierName = companyLine.replace(/^[:\.\s]+/, '').trim();
        }

        // Malzeme (Fallback & Correction)
        // Eğer malzeme boşsa VEYA içinde "Malzeme" kelimesi geçiyorsa (örn: Malzeme Adi..) --> Düzelt
        if (!data.materialType || /(MALZEME|MATERIAL|Adi|Cinsi)/i.test(data.materialType)) {
            // 1. Önce kesin değer satırlarına bak (": TUGLA" gibi) - Columnar receipt için kritik
            const valueLine = lines.find(l => l.trim().startsWith(':') && l.length > 5 && !l.includes('PROJE') && !l.includes('Fiyat'));

            if (valueLine) {
                data.materialType = valueLine.replace(/^[:\.\s]+/, '').trim();
            } else {
                // 2. Yoksa anahtar kelime ara
                const materialLine = lines.find(l =>
                    /(MALZEME|TUGLA|KUM|MICIR|CIMENTO|BETON|NAKLIYE|HAFRIYAT)/i.test(l) &&
                    !/(ADI|AD1|TYPE|CINSI|TONAJ|MIKTAR|TART)/i.test(l) && // İçinde ADI, TYPE geçenleri ALMA
                    !l.trim().endsWith('.') // "Malzeme Adi.." gibi sonu noktalı etiketleri de ele
                );
                if (materialLine) {
                    data.materialType = materialLine.replace(/^[\d\-\.\s]+/, '').trim();
                }
            }
        }

        // Son Temizlik: Hala etiket kaldıysa sil
        if (data.materialType && /(^Malzeme|^Material|^Cinsi|^Tipi)/i.test(data.materialType)) {
            delete data.materialType;
        }

        // C) Konumsal Analiz (Fiş No)
        if (!data.ticketNumber && data.plateNumber) {
            const cleanedPlate = data.plateNumber.replace(/\s+/g, '').toUpperCase();
            let plateLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].replace(/\s+/g, '').toUpperCase().includes(cleanedPlate)) {
                    plateLineIndex = i;
                    break;
                }
            }
            if (plateLineIndex > 0) {
                const prevLine = lines[plateLineIndex - 1].trim();
                if (/^\d+$/.test(prevLine) && prevLine.length < 10) {
                    data.ticketNumber = prevLine;
                }
            }
        }

        // 3. MİKTAR (Regex - Tüm Metinde)
        const quantityPatterns = [
            /(?:Tartı|Tarti)\s*[\.:]*\s*([0-9\.,]+)\s*(?:Kg|KG|Ton|TON)/i,
            /(?:MİKTAR|MIKTAR|QUANTITY|NET|AGIRLIK|ADET)\s*[\.:]*\s*([0-9\.,]+)\s*(TON|M3|M³|METRE|METER|LİTRE|LITER|LITRE|ADET|KG|Kg|kg)?/i,
            /ADET\s*[\.:]*\s*\n?\s*([0-9\.,]+)/i,
            /([0-9\.,]+)\s+(Kg|KG|Ton|TON|Adet|ADET)/i
        ];

        for (const pattern of quantityPatterns) {
            const match = text.match(pattern);
            if (match) {
                let rawQty = match[1];
                let unit = (match[2] || 'ADET').toUpperCase();
                if (rawQty === '.' || rawQty === ',') continue;

                if (/ADET/i.test(unit) || /ADET/i.test(match[0])) {
                    if (rawQty.includes('.') && rawQty.split('.')[1].length === 3) rawQty = rawQty.replace('.', '');
                    unit = 'ADET';
                } else {
                    if (unit === 'KG' && (rawQty.includes(',') || rawQty.includes('.'))) {
                        const clean = rawQty.replace(/[\.,]/g, '');
                        if (clean.length >= 5) rawQty = clean; else rawQty = rawQty.replace(',', '.');
                    } else {
                        rawQty = rawQty.replace(',', '.');
                    }
                }
                data.quantity = rawQty;
                data.unit = unit.replace('M³', 'M3').replace('METREKÜP', 'M3').replace('K8', 'KG');
                break;
            }
        }

        // 4. TARİH
        const datePatterns = [
            /(?:TARİH|TARIH|DATE|GİRİS|GIRIS)\s*[\.:]*\s*(\d{2})[\s\./-]*(\d{2})[\s\./-]*(\d{4})/i,
            /(\d{2})[\s\./-]+(\d{2})[\s\./-]+(\d{4})/,
        ];
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                let year = match[3].replace(/Z/g, '2').replace(/O/g, '0');
                if (year.startsWith('28')) year = '20' + year.substring(2);
                data.date = `${year}-${match[2]}-${match[1]}`;
                break;
            }
        }
        return data;
    }

    validateAndCorrect(ocrData: OCRResult['data']): OCRResult['data'] {
        const corrected = { ...ocrData };
        if (corrected.quantity) {
            let qty = corrected.quantity.replace(/[^0-9\.,]/g, '');
            if (qty.endsWith('.') || qty.endsWith(',')) qty = qty.slice(0, -1);
            if (!qty || qty === '.' || qty === ',') {
                corrected.quantity = undefined;
            } else {
                corrected.quantity = qty;
            }
            if (corrected.unit === 'ADET' && corrected.quantity && corrected.quantity.includes('.')) {
                const parts = corrected.quantity.split('.');
                if (parts[1] && parts[1].length === 3) corrected.quantity = corrected.quantity.replace('.', '');
            }
        }
        return corrected;
    }
}
