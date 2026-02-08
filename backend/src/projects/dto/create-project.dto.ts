import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional } from 'class-validator';

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    district: string;

    @IsString()
    @IsEnum(['ACTIVE', 'COMPLETED'])
    status: string = 'ACTIVE';

    @IsNumber()
    @IsOptional()
    gps_lat?: number;

    @IsNumber()
    @IsOptional()
    gps_lng?: number;
}
