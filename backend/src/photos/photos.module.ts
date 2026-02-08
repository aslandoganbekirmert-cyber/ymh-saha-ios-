import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { FieldPhoto } from './field-photo.entity';
import { Project } from '../projects/project.entity';

@Module({
    imports: [TypeOrmModule.forFeature([FieldPhoto, Project])],
    controllers: [PhotosController],
    providers: [PhotosService],
})
export class PhotosModule { }
