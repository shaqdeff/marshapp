-- Migration: Add confidence scores and additional fields to audio_analyses table
-- Date: 2024-10-23
-- Description: Adds confidence score columns, secondary genres, mood tags, and energy/valence dimensions

-- Add confidence score columns
ALTER TABLE audio_analyses
  ADD COLUMN tempo_confidence DECIMAL(3,2),
  ADD COLUMN key_confidence DECIMAL(3,2),
  ADD COLUMN genre_confidence DECIMAL(3,2);

-- Add secondary genres and mood tags as text arrays
ALTER TABLE audio_analyses
  ADD COLUMN secondary_genres TEXT[],
  ADD COLUMN mood_tags TEXT[];

-- Add energy and valence dimension columns
ALTER TABLE audio_analyses
  ADD COLUMN energy VARCHAR(20),
  ADD COLUMN valence VARCHAR(20);

-- Add comments for documentation
COMMENT ON COLUMN audio_analyses.tempo_confidence IS 'Confidence score for tempo detection (0.00-1.00)';
COMMENT ON COLUMN audio_analyses.key_confidence IS 'Confidence score for key detection (0.00-1.00)';
COMMENT ON COLUMN audio_analyses.genre_confidence IS 'Confidence score for genre classification (0.00-1.00)';
COMMENT ON COLUMN audio_analyses.secondary_genres IS 'Additional genre classifications with lower confidence';
COMMENT ON COLUMN audio_analyses.mood_tags IS 'Multiple mood descriptors for the audio';
COMMENT ON COLUMN audio_analyses.energy IS 'Energy dimension: low, medium, high';
COMMENT ON COLUMN audio_analyses.valence IS 'Valence dimension: sad, neutral, happy';