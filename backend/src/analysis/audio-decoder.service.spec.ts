import { Test, TestingModule } from '@nestjs/testing';
import {
  AudioDecoderService,
  AudioFormat,
  AudioDecodingError,
} from './audio-decoder.service';

describe('AudioDecoderService', () => {
  let service: AudioDecoderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AudioDecoderService],
    }).compile();

    service = module.get<AudioDecoderService>(AudioDecoderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectFormat', () => {
    it('should detect MP3 format from sync bits', () => {
      const mp3Buffer = Buffer.from([
        0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      expect(service.detectFormat(mp3Buffer)).toBe(AudioFormat.MP3);
    });

    it('should detect WAV format from RIFF header', () => {
      const wavBuffer = Buffer.from('RIFF....WAVE', 'ascii');
      expect(service.detectFormat(wavBuffer)).toBe(AudioFormat.WAV);
    });

    it('should detect ID3 tagged MP3', () => {
      const id3Mp3Buffer = Buffer.concat([
        Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00', 'ascii'), // ID3v2 header
        Buffer.from([0xff, 0xfb, 0x90, 0x00]), // MP3 sync bits
      ]);
      expect(service.detectFormat(id3Mp3Buffer)).toBe(AudioFormat.MP3);
    });

    it('should return UNKNOWN for unrecognized format', () => {
      const unknownBuffer = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      ]);
      expect(service.detectFormat(unknownBuffer)).toBe(AudioFormat.UNKNOWN);
    });

    it('should return UNKNOWN for too small buffer', () => {
      const smallBuffer = Buffer.from([0xff, 0xfb]);
      expect(service.detectFormat(smallBuffer)).toBe(AudioFormat.UNKNOWN);
    });
  });

  describe('validateAudioBuffer', () => {
    it('should throw error for empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => service.validateAudioBuffer(emptyBuffer)).toThrow(
        AudioDecodingError,
      );
      expect(() => service.validateAudioBuffer(emptyBuffer)).toThrow(
        'Audio buffer is empty',
      );
    });

    it('should throw error for too small buffer', () => {
      const smallBuffer = Buffer.alloc(50);
      expect(() => service.validateAudioBuffer(smallBuffer)).toThrow(
        AudioDecodingError,
      );
      expect(() => service.validateAudioBuffer(smallBuffer)).toThrow(
        'Audio buffer too small',
      );
    });

    it('should throw error for too large buffer', () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      expect(() => service.validateAudioBuffer(largeBuffer)).toThrow(
        AudioDecodingError,
      );
      expect(() => service.validateAudioBuffer(largeBuffer)).toThrow(
        'Audio file too large',
      );
    });

    it('should throw error for unknown format', () => {
      const unknownBuffer = Buffer.alloc(1000);
      unknownBuffer.fill(0x42); // Fill with non-audio data
      expect(() => service.validateAudioBuffer(unknownBuffer)).toThrow(
        AudioDecodingError,
      );
      expect(() => service.validateAudioBuffer(unknownBuffer)).toThrow(
        'Unsupported or corrupted audio format',
      );
    });

    it('should not throw for valid MP3 buffer', () => {
      const validMp3Buffer = Buffer.alloc(1000);
      validMp3Buffer[0] = 0xff;
      validMp3Buffer[1] = 0xfb;
      expect(() => service.validateAudioBuffer(validMp3Buffer)).not.toThrow();
    });
  });

  describe('getSampleRate', () => {
    it('should return default sample rate for unknown format', () => {
      const unknownBuffer = Buffer.alloc(1000);
      expect(service.getSampleRate(unknownBuffer)).toBe(44100);
    });

    it('should extract sample rate from WAV header', () => {
      // Create a minimal WAV header with 48000 Hz sample rate
      const wavBuffer = Buffer.alloc(100);
      wavBuffer.write('RIFF', 0, 'ascii');
      wavBuffer.write('WAVE', 8, 'ascii');
      wavBuffer.writeUInt32LE(48000, 24); // Sample rate at offset 24

      expect(service.getSampleRate(wavBuffer)).toBe(48000);
    });
  });

  describe('normalizeSamples', () => {
    it('should normalize samples that exceed [-1, 1] range', () => {
      const samples = new Float32Array([2.0, -3.0, 1.5, -0.5]);
      const normalized = service['normalizeSamples'](samples);

      // Should be normalized by factor of 1/3 (max absolute value is 3.0)
      expect(normalized[0]).toBeCloseTo(2.0 / 3.0, 5);
      expect(normalized[1]).toBeCloseTo(-1.0, 5);
      expect(normalized[2]).toBeCloseTo(0.5, 5);
      expect(normalized[3]).toBeCloseTo(-1.0 / 6.0, 5);
    });

    it('should return original samples if already normalized', () => {
      const samples = new Float32Array([0.5, -0.8, 0.3, -0.1]);
      const normalized = service['normalizeSamples'](samples);

      expect(normalized).toBe(samples); // Should return same reference
    });
  });
});
