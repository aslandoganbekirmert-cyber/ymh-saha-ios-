import { Controller, Get, Post, Body, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly service: TransactionsService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @UploadedFile() file: any,
        @Body() body: CreateTransactionDto
    ) {
        // OCR will auto-fill missing fields from the uploaded image
        return this.service.createTransaction(body, file);
    }

    @Get()
    findAll(@Query('project_id') projectId: string) {
        return this.service.findAll(projectId);
    }
}
