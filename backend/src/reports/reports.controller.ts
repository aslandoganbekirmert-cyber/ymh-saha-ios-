
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
    constructor(private readonly service: ReportsService) { }

    @Get('daily')
    async getDaily(@Query('project_id') projectId: string) {
        if (!projectId) throw new Error('Project ID required');
        return this.service.getDailySummary(projectId);
    }
}
