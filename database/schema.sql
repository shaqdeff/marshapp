-- Marshapp Database Schema
-- PostgreSQL Database Schema for AI Music Generation Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Uploads table
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_url TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audio analysis table
CREATE TABLE audio_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
  tempo DECIMAL(5,2),
  key VARCHAR(10),
  genre VARCHAR(100),
  mood VARCHAR(100),
  duration DECIMAL(10,3),
  stems_data JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generations table
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'queued',
  ai_model VARCHAR(100) NOT NULL,
  generation_params JSONB,
  result_url TEXT,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  interpreted_params JSONB,
  result_url TEXT,
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audio versions table (for tracking refinements)
CREATE TABLE audio_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id),
  version_number INTEGER NOT NULL,
  audio_url TEXT NOT NULL,
  waveform_data JSONB,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_job_id ON generations(job_id);
CREATE INDEX idx_prompts_generation_id ON prompts(generation_id);
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_audio_versions_generation_id ON audio_versions(generation_id);
CREATE INDEX idx_audio_versions_current ON audio_versions(is_current);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, name, password_hash) VALUES 
('admin@marshapp.com', 'Admin User', '$2b$10$rQZ9QmjytWzQgwjvtpHzKOXbzQz9QmjytWzQgwjvtpHzKOXbzQz9Qm');