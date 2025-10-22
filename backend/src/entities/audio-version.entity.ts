import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Generation } from './generation.entity';
import { Prompt } from './prompt.entity';

@Entity('audio_versions')
export class AudioVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'generation_id' })
  generationId: string;

  @Column({ name: 'prompt_id', nullable: true })
  promptId: string;

  @Column({ name: 'version_number' })
  versionNumber: number;

  @Column({ name: 'audio_url' })
  audioUrl: string;

  @Column('jsonb', { name: 'waveform_data', nullable: true })
  waveformData: any;

  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Generation, (generation) => generation.audioVersions)
  @JoinColumn({ name: 'generation_id' })
  generation: Generation;

  @ManyToOne(() => Prompt, (prompt) => prompt.audioVersions)
  @JoinColumn({ name: 'prompt_id' })
  prompt: Prompt;
}
