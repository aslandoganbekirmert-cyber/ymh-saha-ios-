
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialTransaction } from '../transactions/transaction.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
    imports: [TypeOrmModule.forFeature([MaterialTransaction])],
    controllers: [ReportsController],
    providers: [ReportsService],
})
export class ReportsModule { }
