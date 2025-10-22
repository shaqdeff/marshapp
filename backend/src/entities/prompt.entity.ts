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
import { Generation } from './generation.entity';
import { AudioVersion } from './audio-version.entity';

@Entity('prompts')
export class Prompt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'generation_id' })
  generationId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'prompt_text' })
  promptText: string;

  @Column('jsonb', { name: 'interpreted_params', nullable: true })
  interpretedParams: any;

  @Column({ name: 'result_url', nullable: true })
  resultUrl: string;

  @Column({ default: 'processing' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Generation, (generation) => generation.prompts)
  @JoinColumn({ name: 'generation_id' })
  generation: Generation;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => AudioVersion, (version) => version.prompt)
  audioVersions: AudioVersion[];
}
