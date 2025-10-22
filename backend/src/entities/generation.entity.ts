import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Upload } from './upload.entity';
import { Prompt } from './prompt.entity';
import { AudioVersion } from './audio-version.entity';

@Entity('generations')
export class Generation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'upload_id' })
  uploadId: string;

  @Column({ name: 'job_id', unique: true })
  jobId: string;

  @Column({ default: 'queued' })
  status: string;

  @Column({ name: 'ai_model' })
  aiModel: string;

  @Column('jsonb', { name: 'generation_params', nullable: true })
  generationParams: any;

  @Column({ name: 'result_url', nullable: true })
  resultUrl: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Upload)
  @JoinColumn({ name: 'upload_id' })
  upload: Upload;

  @OneToMany(() => Prompt, (prompt) => prompt.generation)
  prompts: Prompt[];

  @OneToMany(() => AudioVersion, (version) => version.generation)
  audioVersions: AudioVersion[];
}
