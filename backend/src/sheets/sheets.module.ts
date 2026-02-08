
import { Module, Global } from '@nestjs/common';
import { SheetsService } from './sheets.service';

@Global() // Global because many modules might need logging/reporting
@Module({
    providers: [SheetsService],
    exports: [SheetsService],
})
export class SheetsModule { }
