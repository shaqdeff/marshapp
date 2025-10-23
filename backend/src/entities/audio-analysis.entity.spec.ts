import { AudioAnalysis } from './audio-analysis.entity';

describe('AudioAnalysis Entity', () => {
  it('should create an instance with all fields', () => {
    const analysis = new AudioAnalysis();

    // Set basic fields
    analysis.id = 'test-id';
    analysis.uploadId = 'test-upload-id';
    analysis.tempo = 120.5;
    analysis.tempoConfidence = 0.85;
    analysis.key = 'C major';
    analysis.keyConfidence = 0.92;
    analysis.genre = 'Pop';
    analysis.genreConfidence = 0.78;
    analysis.secondaryGenres = ['Electronic', 'Dance'];
    analysis.mood = 'Energetic';
    analysis.moodTags = ['Uplifting', 'Party'];
    analysis.energy = 'high';
    analysis.valence = 'happy';
    analysis.duration = 180.5;
    analysis.metadata = { version: '2.0' };
    analysis.createdAt = new Date();

    // Verify all fields are set correctly
    expect(analysis.id).toBe('test-id');
    expect(analysis.uploadId).toBe('test-upload-id');
    expect(analysis.tempo).toBe(120.5);
    expect(analysis.tempoConfidence).toBe(0.85);
    expect(analysis.key).toBe('C major');
    expect(analysis.keyConfidence).toBe(0.92);
    expect(analysis.genre).toBe('Pop');
    expect(analysis.genreConfidence).toBe(0.78);
    expect(analysis.secondaryGenres).toEqual(['Electronic', 'Dance']);
    expect(analysis.mood).toBe('Energetic');
    expect(analysis.moodTags).toEqual(['Uplifting', 'Party']);
    expect(analysis.energy).toBe('high');
    expect(analysis.valence).toBe('happy');
    expect(analysis.duration).toBe(180.5);
    expect(analysis.metadata).toEqual({ version: '2.0' });
    expect(analysis.createdAt).toBeInstanceOf(Date);
  });

  it('should handle nullable fields correctly', () => {
    const analysis = new AudioAnalysis();

    // Only set required fields
    analysis.id = 'test-id';
    analysis.uploadId = 'test-upload-id';
    analysis.duration = 180.5;
    analysis.createdAt = new Date();

    // Verify nullable fields can be undefined
    expect(analysis.tempo).toBeUndefined();
    expect(analysis.tempoConfidence).toBeUndefined();
    expect(analysis.key).toBeUndefined();
    expect(analysis.keyConfidence).toBeUndefined();
    expect(analysis.genre).toBeUndefined();
    expect(analysis.genreConfidence).toBeUndefined();
    expect(analysis.secondaryGenres).toBeUndefined();
    expect(analysis.mood).toBeUndefined();
    expect(analysis.moodTags).toBeUndefined();
    expect(analysis.energy).toBeUndefined();
    expect(analysis.valence).toBeUndefined();
  });

  it('should handle array fields correctly', () => {
    const analysis = new AudioAnalysis();

    // Test empty arrays
    analysis.secondaryGenres = [];
    analysis.moodTags = [];

    expect(analysis.secondaryGenres).toEqual([]);
    expect(analysis.moodTags).toEqual([]);

    // Test arrays with multiple values
    analysis.secondaryGenres = ['Rock', 'Alternative', 'Indie'];
    analysis.moodTags = ['Melancholic', 'Introspective', 'Calm'];

    expect(analysis.secondaryGenres).toHaveLength(3);
    expect(analysis.moodTags).toHaveLength(3);
    expect(analysis.secondaryGenres).toContain('Rock');
    expect(analysis.moodTags).toContain('Melancholic');
  });
});
