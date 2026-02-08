import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Get()
    findAll() {
        return this.projectsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.projectsService.findOne(id);
    }

    @Post()
    create(@Body() createProjectDto: CreateProjectDto) {
        // Force coordinates if missing (Office mode)
        if (!createProjectDto.gps_lat) createProjectDto.gps_lat = 0;
        if (!createProjectDto.gps_lng) createProjectDto.gps_lng = 0;

        return this.projectsService.create(createProjectDto);
    }
}
