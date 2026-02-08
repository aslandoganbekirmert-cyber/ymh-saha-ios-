
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialTransaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { SheetsService } from '../sheets/sheets.service';
import { SheetsModule } from '../sheets/sheets.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([MaterialTransaction]),
        ProjectsModule, // ProjectsService için gerekli
        // SheetsModule is @Global(), no need to import it here
    ],
    controllers: [TransactionsController],
    providers: [TransactionsService], // SheetsService comes from Global SheetsModule
    exports: [TransactionsService],
})
export class TransactionsModule { }
