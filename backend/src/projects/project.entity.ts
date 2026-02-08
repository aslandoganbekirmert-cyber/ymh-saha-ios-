import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  district: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  gps_lat: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  gps_lng: number;

  @Column({ default: 'ACTIVE', length: 20 })
  status: string; // 'ACTIVE' | 'COMPLETED'

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
