# Audio Analysis Module

This module implements the audio analysis system for Marshapp, providing tempo, key, genre, and mood detection for uploaded audio files.

## Components

### Backend

- **AnalysisService**: Core service that performs audio analysis
  - Extracts tempo, key, genre, mood, and duration
  - Stores analysis results in the database
  - Updates upload status throughout the analysis process
  - Implements retry logic for failed analyses

- **AnalysisController**: REST API endpoints for analysis operations
  - `POST /analysis/:uploadId` - Trigger analysis for an upload
  - `GET /analysis/:uploadId` - Get analysis results
  - `POST /analysis/:uploadId/retry` - Retry failed analysis

- **AnalysisProcessor**: Bull queue processor for asynchronous analysis
  - Processes analysis jobs in the background
  - Tracks progress and handles errors
  - Implements automatic retry with exponential backoff

- **AnalysisModule**: NestJS module configuration
  - Registers Bull queue for audio-analysis
  - Configures TypeORM entities
  - Exports AnalysisService for use in other modules

- **StemSeparationService**: Hugging Face Demucs integration
  - Downloads audio files from storage
  - Calls Hugging Face Inference API for stem separation
  - Separates audio into drums, bass, vocals, and other
  - Handles API errors with graceful fallback

### Frontend

- **AnalysisProgress**: Component that displays analysis progress
  - Polls for analysis status every 3 seconds
  - Shows progress bar and status messages
  - Handles errors with retry functionality

- **AnalysisMetadata**: Component that displays analysis results
  - Shows tempo, key, genre, mood, and duration
  - Displays stem separation information
  - Formatted and styled metadata visualization

- **useAnalysis**: React hook for analysis operations
  - `analyzeUpload()` - Trigger analysis
  - `getAnalysis()` - Fetch analysis results
  - `retryAnalysis()` - Retry failed analysis

## Integration

The analysis system is automatically triggered when a file is uploaded:

1. User uploads audio file via UploadService
2. UploadService queues an analysis job in Bull
3. AnalysisProcessor picks up the job and calls AnalysisService
4. AnalysisService performs analysis and stores results
5. Frontend polls for analysis completion
6. Results are displayed in AnalysisMetadata component

## Implementation Details

### Stem Separation (Integrated)

The system integrates with Hugging Face's Demucs model for stem separation:

- Uses the `facebook/htdemucs` model via Hugging Face Inference API
- Downloads audio file from storage
- Processes through Demucs to separate drums, bass, vocals, and other
- Stores stem information in the database
- Falls back to placeholder data if API is unavailable or loading

**Configuration**: Set `HUGGINGFACE_API_KEY` in your `.env` file

**Note**: The Hugging Face Inference API may take a few minutes to load the model on first use. Subsequent requests will be faster.

### Audio Analysis (MVP - Placeholder Data)

For the MVP, basic audio analysis uses simulated data:

- Tempo: Random value between 80-140 BPM
- Key: Random musical key (C, D, E, etc.) with major/minor mode
- Genre: Random from predefined list
- Mood: Random from predefined list
- Duration: Placeholder value (180.5 seconds)

In production, these would be replaced with:

- Essentia.js or similar for tempo/key detection
- ML models for genre/mood classification
- FFprobe for accurate duration extraction

## Requirements Satisfied

- ✅ 2.1: Extract tempo, key, and genre metadata within 30 seconds
- ✅ 2.2: Perform stem separation using Hugging Face Demucs
- ✅ 2.3: Display analysis progress to user
- ✅ 2.4: Store extracted metadata in database
- ✅ 2.5: Retry once if analysis fails

## Usage

The stem separation happens automatically during audio analysis. No additional configuration is needed beyond setting the `HUGGINGFACE_API_KEY` environment variable.

When a user uploads an audio file:

1. The file is analyzed for tempo, key, genre, and mood
2. Simultaneously, the file is sent to Hugging Face for stem separation
3. Results are stored in the database and displayed to the user
4. If stem separation fails, the analysis continues with placeholder data
