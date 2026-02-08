
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

    async appendRow(spreadsheetId: string, rowData: any[]) {
        if (!this.client) return;

        try {
            // GoogleAuth handles authorization automatically
            const sheets = google.sheets({ version: 'v4', auth: this.client as any });

            const response = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'A:I', // İlk sayfada A-I kolonları arasına ekle (Daha spesifik)
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS', // Mevcut satırların üzerine yazmak yerine yeni satır ekle
                requestBody: {
                    values: [rowData],
                },
            });

            // Eklenen satırın indeksini bul
            const updates = response.data.updates;
            if (updates && updates.updatedRange) {
                // Range örneği: 'Sayfa1!A15:I15'
                const match = updates.updatedRange.match(/[A-Z]+(\d+):[A-Z]+(\d+)/);
                if (match) {
                    const startRowIndex = parseInt(match[1]) - 1; // 0-indexed
                    // const endRowIndex = parseInt(match[2]);

                    // Eğer ilk satır değilse (başlık değilse), bir üst satırın formatını kopyala
                    if (startRowIndex > 1) {
                        await sheets.spreadsheets.batchUpdate({
                            spreadsheetId,
                            requestBody: {
                                requests: [
                                    {
                                        copyPaste: {
                                            source: {
                                                sheetId: 0, // Varsayılan ilk sayfa (Genelde ID 0'dır)
                                                startRowIndex: startRowIndex - 1,
                                                endRowIndex: startRowIndex,
                                                startColumnIndex: 0,
                                                endColumnIndex: 9 // I kolonu (9. kolon)
                                            },
                                            destination: {
                                                sheetId: 0,
                                                startRowIndex: startRowIndex,
                                                endRowIndex: startRowIndex + 1,
                                                startColumnIndex: 0,
                                                endColumnIndex: 9
                                            },
                                            pasteType: 'PASTE_FORMAT',
                                            pasteOrientation: 'NORMAL'
                                        }
                                    }
                                ]
                            }
                        });
                        console.log(`[SheetsService] Copied format to row ${startRowIndex + 1}`);
                    }
                }
            }

            console.log(`[SheetsService] Appended row to ${spreadsheetId}`);
        } catch (error) {
            console.error('[SheetsService] Failed to append row:', error);
            // throw error; // Hata fırlatma, çünkü ana akışı bozmasın (Transaction kaydedilsin)
        }
    }
}
