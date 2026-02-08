
import { Module, Global } from '@nestjs/common';
import { OCRService } from './ocr.service';

@Global()
@Module({
    providers: [OCRService],
    exports: [OCRService],
})
export class OCRModule { }
