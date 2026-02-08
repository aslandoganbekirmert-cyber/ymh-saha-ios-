
import { Injectable } from '@nestjs/common';
import { IStorageService } from './storage.interface';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryStorageService implements IStorageService {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        console.log('[CloudinaryStorage] Initialized with cloud:', process.env.CLOUDINARY_CLOUD_NAME);
    }

    async upload(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<{ key: string; bucket: string; url: string }> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'ymh-saha',
                    public_id: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) {
                        console.error('[CloudinaryStorage] Upload failed:', error);
                        reject(error);
                    } else if (result) {
                        console.log('[CloudinaryStorage] Uploaded:', result.secure_url);
                        resolve({
                            key: result.public_id,
                            bucket: 'cloudinary',
                            url: result.secure_url,
                        });
                    } else {
                        reject(new Error('Upload failed: No result returned'));
                    }
                }
            );

            uploadStream.end(fileBuffer);
        });
    }

    async delete(key: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(key);
            console.log('[CloudinaryStorage] Deleted:', key);
        } catch (error) {
            console.error('[CloudinaryStorage] Delete failed:', error);
        }
    }
}
