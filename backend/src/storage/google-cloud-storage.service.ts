
import { Injectable } from '@nestjs/common';
import { IStorageService } from './storage.interface';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';

@Injectable()
export class GoogleCloudStorageService implements IStorageService {
    private storage: Storage;
    private bucketName: string;

    constructor() {
        // Explicitly check for credentials file or let ADC handle it
        const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        this.storage = new Storage({
            keyFilename: keyFilePath,
            projectId: process.env.GCP_PROJECT_ID
        });

        this.bucketName = process.env.GCP_BUCKET_NAME || 'ymh-uploads';
    }

    async upload(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<{ key: string; bucket: string; url: string }> {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(fileName);

        await file.save(fileBuffer, {
            contentType: mimeType,
            resumable: false,
        });

        // If public access is needed:
        // await file.makePublic(); 

        // Return signed URL or public URL depending on needs. 
        // For now, returning the cloud storage URI format.
        return {
            key: fileName,
            bucket: this.bucketName,
            url: `https://storage.googleapis.com/${this.bucketName}/${fileName}`
        };
    }

    async delete(key: string): Promise<void> {
        await this.storage.bucket(this.bucketName).file(key).delete();
    }
}
