import { Injectable, Logger } from '@nestjs/common';
import { IStorageService } from './storage.interface';
import { google } from 'googleapis';
import * as stream from 'stream';

@Injectable()
export class GoogleDriveStorageService implements IStorageService {
    private readonly logger = new Logger(GoogleDriveStorageService.name);
    private driveClient;
    private folderCache = new Map<string, string>(); // Path -> Folder ID

    constructor() {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json';
        this.logger.log(`Initializing Google Drive Storage with credentials: ${credentialsPath}`);

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/drive'],
            });
            this.driveClient = google.drive({ version: 'v3', auth });
        } catch (error) {
            this.logger.error('Failed to initialize Google Drive client', error);
        }
    }

    async upload(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<{ key: string; bucket: string; url: string }> {
        if (!this.driveClient) {
            throw new Error('Google Drive client not initialized');
        }

        try {
            // Extract folder path and actual filename
            // fileName format: "2024-02-03/2024-02-03-34VR123-KUM.jpg"
            const parts = fileName.split('/');
            const actualFileName = parts.pop();
            const folderPath = parts.join('/'); // "2024-02-03"

            // Find or get parent folder ID
            const parentFolderId = await this.ensureFolderExists(folderPath);

            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            const response = await this.driveClient.files.create({
                requestBody: {
                    name: actualFileName,
                    parents: parentFolderId ? [parentFolderId] : [], // Use root if no parent
                },
                media: {
                    mimeType: mimeType,
                    body: bufferStream,
                },
                fields: 'id, name, webViewLink, webContentLink',
            });

            const file = response.data;
            this.logger.log(`Uploaded file to Drive: ${file.name} (${file.id})`);

            return {
                key: file.id, // We use Drive File ID as key
                bucket: 'google-drive',
                url: file.webViewLink, // This link requires permission to view
            };

        } catch (error) {
            this.logger.error('Upload to Drive failed', error);
            throw error;
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.driveClient.files.delete({ fileId: key });
        } catch (error) {
            this.logger.warn(`Failed to delete file ${key} from Drive`, error);
        }
    }

    private async ensureFolderExists(folderName: string): Promise<string | null> {
        if (!folderName) return null; // Root folder

        // Check cache first
        if (this.folderCache.has(folderName)) {
            return this.folderCache.get(folderName) || null;
        }

        // Search for folder
        // For MVP, we search in the root directory effectively or shared folders provided to service account
        // If we want nested folders (year/month/day), this needs recursion.
        // Assuming simple one-level folder for now as per requirement "Günlük klasör"

        try {
            // Query: name = 'folderName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false
            const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const res = await this.driveClient.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            if (res.data.files && res.data.files.length > 0) {
                // Folder exists
                const folderId = res.data.files[0].id;
                this.folderCache.set(folderName, folderId);
                return folderId;
            } else {
                // Create folder
                const folderMetadata = {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                };
                const folder = await this.driveClient.files.create({
                    requestBody: folderMetadata,
                    fields: 'id',
                });
                const folderId = folder.data.id;
                this.folderCache.set(folderName, folderId);

                // IMPORTANT: Service Account creates this folder. 
                // The User cannot see it unless shared.
                // We should share this folder with a specific user if configured, 
                // OR we rely on the fact that if the user shared a parent folder, we should have put it there.
                // For now, it stays in Service Account's Drive.
                // To fix visibility: User should perform a one-time setup to share a folder with service account,
                // and put its ID in env as DRIVE_ROOT_FOLDER_ID.
                // But let's stick to simple logic first.

                return folderId;
            }
        } catch (error) {
            this.logger.error(`Error finding/creating folder ${folderName}`, error);
            return null; // Fallback to root
        }
    }
}
