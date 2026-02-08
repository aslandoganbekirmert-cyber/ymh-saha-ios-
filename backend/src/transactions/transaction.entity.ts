import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from '../projects/project.entity';
import { FieldPhoto } from '../photos/field-photo.entity';

@Entity('material_transactions')
export class MaterialTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // @ManyToOne(() => Project, { nullable: true })
    // @JoinColumn({ name: 'project_id' })
    // project: Project;

    @Column()
    project_id: string;

    // Photo Proof (Optional but recommended)
    // @ManyToOne(() => FieldPhoto, { nullable: true })
    // @JoinColumn({ name: 'photo_id' })
    // photo: FieldPhoto;

    @Column({ nullable: true })
    photo_id: string;

    // Transaction Details
    @Column({ length: 50, default: 'IN' })
    type: string; // 'INCOMING' (Giriş) or 'OUTGOING' (Çıkış/Hafriyat)

    @Column({ length: 100, nullable: true })
    material_type: string; // 'HAFRIYAT', 'MIL_KUM', 'TUGLA', 'PARKE', etc.

    @Column({ length: 100, nullable: true })
    supplier_name: string; // 'NALDOKEN', 'OZELIZ', etc.

    // Waybill Data
    @Column({ length: 20, nullable: true })
    plate_number: string; // 35 BYL 690

    @Column({ length: 50, nullable: true })
    ticket_number: string; // Kantar Fiş No

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    quantity: number; // 18.5

    @Column({ length: 20, default: 'TON' })
    unit: string; // TON, M3, ADET

    // Metadata
    @CreateDateColumn()
    created_at: Date;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    transaction_date: Date;

    @Column({ nullable: true })
    notes: string;

    // OCR Integration
    @Column('simple-json', { nullable: true })
    ocr_data: any;

    @Column({ default: false })
    is_ocr_verified: boolean;

    // Sync Status
    @Column({ default: false })
    is_synced_sheets: boolean;

    @Column({ nullable: true })
    sync_error: string;
}
