# Database Migration Notes

## Migration 001: Add Confidence Scores and Additional Fields

**Date:** 2024-10-23  
**Migration File:** `migrations/001_add_confidence_scores.sql`  
**Rollback File:** `migrations/001_rollback_confidence_scores.sql`

### Changes Made

This migration adds confidence scores and additional analysis fields to the `audio_analyses` table to support improved audio analysis accuracy.

#### New Columns Added:

1. **Confidence Scores:**
   - `tempo_confidence` (DECIMAL(3,2)) - Confidence score for tempo detection (0.00-1.00)
   - `key_confidence` (DECIMAL(3,2)) - Confidence score for key detection (0.00-1.00)
   - `genre_confidence` (DECIMAL(3,2)) - Confidence score for genre classification (0.00-1.00)

2. **Additional Classification Fields:**
   - `secondary_genres` (TEXT[]) - Additional genre classifications with lower confidence
   - `mood_tags` (TEXT[]) - Multiple mood descriptors for the audio

3. **Mood Dimensions:**
   - `energy` (VARCHAR(20)) - Energy dimension: low, medium, high
   - `valence` (VARCHAR(20)) - Valence dimension: sad, neutral, happy

### Usage

#### Running the Migration:

```bash
node database/run-migration.js
```

#### Rolling Back (if needed):

```bash
# Manually run the rollback SQL
psql -d marshapp -f database/migrations/001_rollback_confidence_scores.sql
```

### Entity Updates

The `AudioAnalysis` entity has been updated to include all new fields:

```typescript
@Entity('audio_analyses')
export class AudioAnalysis {
  // ... existing fields ...

  @Column('decimal', { precision: 3, scale: 2, nullable: true, name: 'tempo_confidence' })
  tempoConfidence: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true, name: 'key_confidence' })
  keyConfidence: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true, name: 'genre_confidence' })
  genreConfidence: number;

  @Column('simple-array', { nullable: true, name: 'secondary_genres' })
  secondaryGenres: string[];

  @Column('simple-array', { nullable: true, name: 'mood_tags' })
  moodTags: string[];

  @Column({ length: 20, nullable: true })
  energy: string;

  @Column({ length: 20, nullable: true })
  valence: string;
}
```

### Service Updates

The `AnalysisService` has been updated to:

- Use the new `analyzeFromUrl` method instead of the legacy version
- Map all confidence scores and additional fields from the analyzer
- Store the new fields in the database

### Requirements Satisfied

This migration satisfies the following requirements from the audio analysis accuracy fix:

- **1.1:** Tempo detection with confidence scoring
- **3.4:** Key detection confidence and uncertainty marking
- **6.4:** Genre classification confidence scoring
- **6.5:** Secondary genre support
- **7.2:** Mood dimension classification (energy/valence)
- **7.4:** Multiple mood tag support

### Testing

Unit tests have been added to verify:

- Entity field mapping works correctly
- Array fields handle multiple values
- Nullable fields work as expected
- All new fields can be set and retrieved

Run tests with:

```bash
npm test backend/src/entities/audio-analysis.entity.spec.ts
```
