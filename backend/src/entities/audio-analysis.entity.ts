import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Upload } from './upload.entity';

@Entity('audio_analyses')
export class AudioAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'upload_id' })
  uploadId: string;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  tempo: number;

  @Column({ nullable: true })
  key: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  mood: string;

  @Column('decimal', { precision: 10, scale: 3, nullable: true })
  duration: number;

  @Column('jsonb', { name: 'stems_data', nullable: true })
  stemsData: any;

  @Column('jsonb', { nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => Upload, (upload) => upload.analysis)
  @JoinColumn({ name: 'upload_id' })
  upload: Upload;
}
