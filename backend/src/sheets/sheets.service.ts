
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
// import { JWT } from 'google-auth-library';

@Injectable()
export class SheetsService {
    private serviceAccountEmail: string;
    private privateKey: string;
    private client: any;

    constructor() {
        // Use credentials file - GoogleAuth will handle everything
        const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json';

        try {
            const path = require('path');
            const keyPath = path.resolve(keyFile);

            console.log('[SheetsService] Loading credentials from:', keyPath);

            // Use GoogleAuth with keyFilename - this is the recommended approach
            this.client = new google.auth.GoogleAuth({
                keyFilename: keyPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            // Read service account email for logging
            const fs = require('fs');
            const keyContent = fs.readFileSync(keyPath, 'utf8');
            const keys = JSON.parse(keyContent);
            this.serviceAccountEmail = keys.client_email;

            console.log('[SheetsService] Initialized with service account:', this.serviceAccountEmail);

        } catch (error) {
            console.error('[SheetsService] Failed to load credentials from file:', error.message);
        }
    }

    async addSheet(spreadsheetId: string, title: string) {
        if (!this.client) return;
        try {
            const sheets = google.sheets({ version: 'v4', auth: this.client });

            // Önce sayfa var mı kontrol et
            const doc = await sheets.spreadsheets.get({ spreadsheetId });
            const existingSheet = doc.data.sheets?.find(s => s.properties?.title === title);

            if (existingSheet) {
                console.log(`[SheetsService] Sheet '${title}' already exists.`);
                return existingSheet.properties?.sheetId;
            }

            // Yoksa yeni sayfa ekle
            const response = await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: title }
                        }
                    }]
                }
            });

            const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
            console.log(`[SheetsService] Created new sheet: ${title} (ID: ${newSheetId})`);

            // Başlık satırını ekle
            await this.appendRow(spreadsheetId, title, [
                'Tarih', 'Saat', 'Proje', 'Plaka', 'Malzeme', 'Miktar', 'Birim', 'Tedarikçi', 'Fiş No', 'Notlar'
            ]);

            return newSheetId;
        } catch (error) {
            console.error(`[SheetsService] Failed to add sheet '${title}':`, error.message);
        }
    }

    async appendRow(spreadsheetId: string, sheetTitle: string, rowData: any[]) {
        if (!this.client) return;

        try {
            const sheets = google.sheets({ version: 'v4', auth: this.client });

            // Sayfa adını range'e ekle (Örn: 'Evka-5!A:J')
            // Eğer sheetTitle boşsa varsayılan ilk sayfayı kullanır ama biz hep title gönderelim.
            const range = sheetTitle ? `'${sheetTitle}'!A:J` : 'A:J';

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values: [rowData],
                },
            });

            console.log(`[SheetsService] Appended row to ${spreadsheetId} -> ${sheetTitle}`);
        } catch (error) {
            console.error('[SheetsService] Failed to append row:', error.message);
        }
    }
}
