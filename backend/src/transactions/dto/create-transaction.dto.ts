
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
    @IsOptional() // Can be filled by OCR
    @IsString()
    project_id?: string;

    @IsOptional() // Can be filled by OCR
    @IsString()
    material_type?: string;

    @IsOptional() // Can be filled by OCR
    @Type(() => Number)
    @IsNumber()
    quantity?: number;

    @IsOptional() // Can be filled by OCR
    @IsString()
    unit?: string;

    @IsOptional() // Can be filled by OCR
    @IsString()
    plate_number?: string;

    @IsOptional()
    @IsString()
    supplier_name?: string;

    @IsOptional()
    @IsString()
    ticket_number?: string;

    @IsOptional()
    @IsString()
    type?: 'IN' | 'OUT'; // INCOMING or OUTGOING
}
