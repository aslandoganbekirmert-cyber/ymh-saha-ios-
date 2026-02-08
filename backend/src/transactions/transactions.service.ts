import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialTransaction } from './transaction.entity';
import { SheetsService } from '../sheets/sheets.service';
import { OCRService } from '../ocr/ocr.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ProjectsService } from '../projects/projects.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { IStorageService } from '../storage/storage.interface';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(MaterialTransaction)
        private repo: Repository<MaterialTransaction>,
        private sheetsService: SheetsService,
        private ocrService: OCRService,
        private projectsService: ProjectsService,
        @Inject(STORAGE_SERVICE)
        private storageService: IStorageService,
    ) { }

    async createTransaction(body: CreateTransactionDto, file?: any) {
        // Determine file name if file exists
        let photoUrl = '';
        let uploadId: string | undefined;
        let ocrData: any = null;

        if (file) {
            // Format: YYYY-MM-DD/YYYY-MM-DD-Plate-Material.jpg
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // 2024-02-03

            // Sanitize inputs for filename
            const safePlate = (body.plate_number || 'NoPlate').replace(/\s+/g, '').toUpperCase();
            const safeMaterial = (body.material_type || 'Material').replace(/\s+/g, '-').toUpperCase();

            // Folder structure: Daily folder
            const fileName = `${dateStr}/${dateStr}-${safeMaterial}-${safePlate}.jpg`;

            const uploadResult = await this.storageService.upload(file.buffer, fileName, 'image/jpeg');
            photoUrl = uploadResult.url;
            uploadId = uploadResult.key;

            // OCR Processing - Extract data from waybill image
            try {
                console.log('[TransactionsService] Starting OCR processing...');
                const ocrResult = await this.ocrService.extractText(file.buffer);

                console.log('[TransactionsService] OCR Result:', {
                    confidence: ocrResult.confidence,
                    extractedData: ocrResult.data,
                });

                // Validate and correct OCR data
                const correctedData = this.ocrService.validateAndCorrect(ocrResult.data);

                // Store full OCR result for debugging
                ocrData = {
                    rawText: ocrResult.text,
                    confidence: ocrResult.confidence,
                    extracted: correctedData,
                };

                // Auto-fill missing fields from OCR (if not provided in form)
                if (!body.plate_number && correctedData.plateNumber) {
                    body.plate_number = correctedData.plateNumber;
                    console.log('[TransactionsService] Auto-filled plate_number from OCR:', correctedData.plateNumber);
                }
                if (!body.material_type && correctedData.materialType) {
                    body.material_type = correctedData.materialType;
                    console.log('[TransactionsService] Auto-filled material_type from OCR:', correctedData.materialType);
                }
                if (!body.quantity && correctedData.quantity) {
                    body.quantity = parseFloat(correctedData.quantity);
                    console.log('[TransactionsService] Auto-filled quantity from OCR:', correctedData.quantity);
                }
                if (!body.unit && correctedData.unit) {
                    body.unit = correctedData.unit;
                    console.log('[TransactionsService] Auto-filled unit from OCR:', correctedData.unit);
                }
                if (!body.supplier_name && correctedData.supplierName) {
                    body.supplier_name = correctedData.supplierName;
                    console.log('[TransactionsService] Auto-filled supplier_name from OCR:', correctedData.supplierName);
                }
                if (!body.ticket_number && correctedData.ticketNumber) {
                    body.ticket_number = correctedData.ticketNumber;
                    console.log('[TransactionsService] Auto-filled ticket_number from OCR:', correctedData.ticketNumber);
                }

            } catch (error) {
                console.error('[TransactionsService] OCR processing failed:', error);
                // OCR failure should not block transaction creation
                ocrData = { error: error.message };
            }
        }

        const tx = this.repo.create({
            ...body,
            photo_id: uploadId, // Storing reference to storage key
            ocr_data: ocrData, // Store OCR result
            // ensure quantity is number
            quantity: typeof body.quantity === 'string' ? parseFloat(body.quantity) : body.quantity,
        });

        const saved = await this.repo.save(tx);

        // Sync to Google Sheets
        let syncStatus = false;
        let syncErr: string | null = null;

        if (saved && saved.project_id) {
            const spreadsheetId = process.env.GOOGLE_SHEET_ID;

            if (spreadsheetId) {
                try {
                    // Proje Adını Bul (Sekme Adı Olarak Kullanılacak)
                    const project = await this.projectsService.findOne(saved.project_id);
                    const sheetTitle = project ? project.name : 'Unknown';

                    // Tarih ve Saat Ayrıştırma
                    const txDate = saved.transaction_date || saved.created_at || new Date();
                    const dateVal = txDate instanceof Date ? txDate : new Date(txDate);

                    const datePart = dateVal.toISOString().split('T')[0];
                    const timePart = dateVal.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                    const row = [
                        datePart,           // Tarih
                        timePart,           // Saat
                        sheetTitle,         // Proje
                        saved.plate_number, // Plaka
                        saved.material_type,// Malzeme
                        saved.quantity,     // Miktar
                        saved.unit,         // Birim
                        saved.supplier_name || '', // Tedarikçi
                        saved.ticket_number || '', // Fiş No
                        saved.notes || photoUrl // Notlar (Varsa URL)
                    ];

                    await this.sheetsService.appendRow(spreadsheetId, sheetTitle, row);
                    syncStatus = true;
                    console.log(`Synced to Sheet: ${sheetTitle}`);
                } catch (e) {
                    const syncErrMessage = (e instanceof Error) ? e.message : 'Unknown Sheet Error';
                    console.error('Google Sheets Sync Failed:', syncErrMessage);
                    saved.is_synced_sheets = false; // Explicitly set to false on failure
                    saved.sync_error = syncErrMessage;
                    await this.repo.save(saved); // Save immediately on failure
                    return saved; // Return early after saving sync error
                }
            } else {
                syncErr = 'GOOGLE_SHEET_ID not configured';
            }
        }

        // Update sync status in DB if not already saved due to an error
        if (saved && syncErr !== null) { // This block handles the case where GOOGLE_SHEET_ID is not configured
            saved.is_synced_sheets = syncStatus; // Will be false
            saved.sync_error = syncErr;
            await this.repo.save(saved);
        } else if (saved && syncStatus === true) { // This block handles successful sync
            saved.is_synced_sheets = syncStatus;
            saved.sync_error = ""; // Clear any previous error if successful
            await this.repo.save(saved);
        }


        return saved;
    }

    async findAll(projectId: string) {
        return this.repo.find({
            where: { project_id: projectId },
            order: { created_at: 'DESC' },
            take: 50
        });
    }
}
