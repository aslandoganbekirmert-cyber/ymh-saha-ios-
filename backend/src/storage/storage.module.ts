import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { GoogleCloudStorageService } from './google-cloud-storage.service';
import { GoogleDriveStorageService } from './google-drive-storage.service';
import { CloudinaryStorageService } from './cloudinary-storage.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: STORAGE_SERVICE,
            useFactory: (configService: ConfigService) => {
                const storageType = configService.get('STORAGE_TYPE');
                if (storageType === 'gcs') {
                    return new GoogleCloudStorageService();
                }
                if (storageType === 'drive') {
                    return new GoogleDriveStorageService();
                }
                if (storageType === 'cloudinary') {
                    return new CloudinaryStorageService();
                }
                return new LocalStorageService();
            },
            inject: [ConfigService],
        },
    ],
    exports: [STORAGE_SERVICE],
})
export class StorageModule { }
