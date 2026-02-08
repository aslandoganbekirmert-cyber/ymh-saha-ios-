
import { Injectable } from '@nestjs/common';
import { IStorageService } from './storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
    private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');

    constructor() {
        if (!fs.existsSync(this.UPLOAD_DIR)) {
            fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
        }
    }

    async upload(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<{ key: string; bucket: string; url: string }> {
        const filePath = path.join(this.UPLOAD_DIR, fileName);

        // Create parent directories if they don't exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, fileBuffer);

        return {
            key: fileName,
            bucket: 'local',
            url: `file://${filePath}`
        };
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.UPLOAD_DIR, key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
