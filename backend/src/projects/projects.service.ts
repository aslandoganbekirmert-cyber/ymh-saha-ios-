import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private projectsRepository: Repository<Project>,
    ) { }

    findAll(): Promise<Project[]> {
        return this.projectsRepository.find({ order: { created_at: 'DESC' } });
    }

    findOne(id: string): Promise<Project | null> {
        return this.projectsRepository.findOneBy({ id });
    }

    async create(createProjectDto: CreateProjectDto): Promise<Project> {
        const project = this.projectsRepository.create(createProjectDto);
        return this.projectsRepository.save(project);
    }

    async findNearest(lat: number, lng: number): Promise<Project | null> {
        const projects = await this.findAll();
        let nearest: Project | null = null;
        let minDistance = Infinity;
        const THRESHOLD_METERS = 2000;

        for (const p of projects) {
            if (!p.gps_lat || !p.gps_lng) continue;
            const dist = this.getDistanceFromLatLonInM(lat, lng, p.gps_lat, p.gps_lng);
            if (dist < minDistance && dist < THRESHOLD_METERS) {
                minDistance = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    private getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
        var R = 6371;
        var dLat = this.deg2rad(lat2 - lat1);
        var dLon = this.deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c;
        return d * 1000;
    }

    private deg2rad(deg: number) {
        return deg * (Math.PI / 180);
    }
}
