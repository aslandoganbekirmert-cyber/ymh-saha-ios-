
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialTransaction } from './transaction.entity';
import { SheetsService } from '../sheets/sheets.service';
import { OCRService } from '../ocr/ocr.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
// IStorageService should be normal import in Nest, but if needed as type:
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { IStorageService } from '../storage/storage.interface';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(MaterialTransaction)
        private repo: Repository<MaterialTransaction>,
        private sheetsService: SheetsService,
        private ocrService: OCRService,
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

        const saved = await this.repo.save(tx) as any;

        // Sync to Google Sheets
        let syncStatus = false;
        let syncErr: string | null = null;

        if (saved && saved.project_id) {
            const dateVal = saved.created_at ? saved.created_at.toISOString() : new Date().toISOString();
            const row = [
                saved.project_id,
                dateVal,
                saved.plate_number,
                saved.material_type,
                saved.quantity,
                saved.unit,
                saved.supplier_name || '',
                saved.ticket_number || '',
                photoUrl // Direct link to photo in Drive/GCS
            ];

            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            if (spreadsheetId) {
                try {
                    await this.sheetsService.appendRow(spreadsheetId, row);
                    syncStatus = true;
                } catch (e) {
                    syncErr = e.message;
                    console.error('Sheets Sync Error:', e);
                }
            } else {
                syncErr = 'GOOGLE_SHEETS_ID not configured';
            }
        }

        // Update sync status in DB
        if (saved) {
            saved.is_synced_sheets = syncStatus;
            saved.sync_error = syncErr;
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
