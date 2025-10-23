-- Rollback Migration: Remove confidence scores and additional fields from audio_analyses table
-- Date: 2024-10-23
-- Description: Removes the columns added in 001_add_confidence_scores.sql

-- Remove the new columns
ALTER TABLE audio_analyses
  DROP COLUMN IF EXISTS tempo_confidence,
  DROP COLUMN IF EXISTS key_confidence,
  DROP COLUMN IF EXISTS genre_confidence,
  DROP COLUMN IF EXISTS secondary_genres,
  DROP COLUMN IF EXISTS mood_tags,
  DROP COLUMN IF EXISTS energy,
  DROP COLUMN IF EXISTS valence;