import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProjectsModule } from './projects/projects.module';
import { PhotosModule } from './photos/photos.module';
import { TransactionsModule } from './transactions/transactions.module';
import { Project } from './projects/project.entity';
import { FieldPhoto } from './photos/field-photo.entity';
import { StorageModule } from './storage/storage.module';
import { OCRModule } from './ocr/ocr.module';
import { SheetsModule } from './sheets/sheets.module';
import { MaterialTransaction } from './transactions/transaction.entity';
import { MaterialType } from './transactions/material-type.entity';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE', 'sqlite');

        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USER', 'ymh_user'),
            password: configService.get<string>('DB_PASS', 'ymh_password'),
            database: configService.get<string>('DB_NAME', 'ymh_db'),
            entities: [Project, FieldPhoto, MaterialTransaction, MaterialType],
            synchronize: true, // Auto-schema update, disable in production
          };
        }

        return {
          type: 'sqlite',
          database: 'ymh.sqlite',
          entities: [Project, FieldPhoto, MaterialTransaction, MaterialType],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    ProjectsModule,
    PhotosModule,
    TransactionsModule,
    StorageModule,
    OCRModule,
    SheetsModule,
    ReportsModule,
  ],
})
export class AppModule { }
