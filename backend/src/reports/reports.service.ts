
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialTransaction } from '../transactions/transaction.entity';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(MaterialTransaction)
        private repo: Repository<MaterialTransaction>,
    ) { }

    async getDailySummary(projectId: string) {
        // Calculate totals for today
        // This is a simple implementation. For production, consider timezone handling.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const builder = this.repo.createQueryBuilder('tx')
            .where('tx.project_id = :projectId', { projectId })
            .select('tx.material_type', 'material')
            .addSelect('tx.unit', 'unit')
            .addSelect('SUM(tx.quantity)', 'total')
            .addSelect('COUNT(tx.id)', 'count')
            .groupBy('tx.material_type')
            .addGroupBy('tx.unit');

        const stats = await builder.getRawMany();

        return {
            date: today.toISOString(),
            stats: stats.map(s => ({
                material: s.material,
                unit: s.unit,
                total: parseFloat(s.total),
                count: parseInt(s.count)
            }))
        };
    }
}
