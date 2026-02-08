import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreatePhotoDto {
    @IsUUID()
    @IsNotEmpty()
    project_id: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    // We accept strings for lat/lng from multipart form data usually, 
    // but if JSON, number. I'll assume JSON body for metadata or transform.
    // NestJS with FileInterceptor handles body.
    @IsString()
    @IsNotEmpty()
    gps_lat: string;

    @IsString()
    @IsNotEmpty()
    gps_lng: string;

    @IsString()
    @IsOptional()
    gps_accuracy?: string;

    @IsDateString()
    @IsNotEmpty()
    device_timestamp: string;

    @IsString() // boolean sent as string in multipart
    @IsOptional()
    is_offline_capture?: string;

    @IsString()
    @IsOptional()
    voice_note_text?: string;
}
