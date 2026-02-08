
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('material_types')
export class MaterialType {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string; // e.g. "KIRIS KUM", "BETON C30", "PARKE TASI"

    @Column()
    unit: string; // e.g. "TON", "M3", "ADET"

    @Column({ nullable: true })
    default_supplier: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
