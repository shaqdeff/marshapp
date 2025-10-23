#!/usr/bin/env ts-node

/**
 * Validation script for audio analysis accuracy improvements
 * Tests the requirements from task 15: Deploy and validate in staging environment
 *
 * This script validates:
 * - 97 BPM detected correctly (±2 BPM tolerance)
 * - 3:20 duration accurate (±0.5s tolerance)
 * - Genre and mood accuracy
 * - Performance and error rates
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  AudioAnalyzerService,
  AnalysisResult,
} from '../analysis/audio-analyzer.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  name: string;
  audioUrl: string;
  expectedTempo: number;
  expectedDuration: number; // in seconds
  expectedGenre?: string;
  expectedMood?: string;
  description: string;
}

interface ValidationResult {
  testCase: string;
  passed: boolean;
  results: {
    tempo: {
      detected: number;
      expected: number;
      withinTolerance: boolean;
      tolerance: number;
    };
    duration: {
      detected: number;
      expected: number;
      withinTolerance: boolean;
      tolerance: number;
    };
    genre?: {
      detected: string;
      expected?: string;
      confidence: number;
    };
    mood?: {
      detected: string;
      expected?: string;
      confidence: number;
    };
  };
  processingTime: number;
  error?: string;
}

class AnalysisValidator {
  private readonly logger = new Logger(AnalysisValidator.name);
  private readonly TEMPO_TOLERANCE = 2; // ±2 BPM as per requirements
  private readonly DURATION_TOLERANCE = 0.5; // ±0.5s as per requirements
  private readonly MAX_PROCESSING_TIME = 30000; // 30 seconds as per requirements

  constructor(private audioAnalyzer: AudioAnalyzerService) {}

  /**
   * Test cases for validation
   * Note: In a real staging environment, these would be actual test audio files
   * For this demo, we'll use mock URLs that represent the test scenarios
   */
  private getTestCases(): TestCase[] {
    return [
      {
        name: 'Primary Test Case - 97 BPM, 3:20 Duration',
        audioUrl: 'https://example.com/test-audio/97bpm-3min20sec.mp3',
        expectedTempo: 97,
        expectedDuration: 200, // 3:20 = 200 seconds
        expectedGenre: 'Afrobeat',
        expectedMood: 'Energetic',
        description:
          'Main test case from requirements - must detect 97 BPM and 3:20 duration accurately',
      },
      {
        name: 'Afrobeat Genre Test',
        audioUrl: 'https://example.com/test-audio/afrobeat-sample.mp3',
        expectedTempo: 105,
        expectedDuration: 180,
        expectedGenre: 'Afrobeat',
        expectedMood: 'Uplifting',
        description: 'Test Afrobeat genre classification accuracy',
      },
      {
        name: 'Reggaeton Test',
        audioUrl: 'https://example.com/test-audio/reggaeton-sample.mp3',
        expectedTempo: 95,
        expectedDuration: 210,
        expectedGenre: 'Reggaeton',
        expectedMood: 'Party',
        description: 'Test Reggaeton genre classification',
      },
      {
        name: 'Hip-Hop Test',
        audioUrl: 'https://example.com/test-audio/hiphop-sample.mp3',
        expectedTempo: 85,
        expectedDuration: 195,
        expectedGenre: 'Hip-Hop',
        expectedMood: 'Chill',
        description: 'Test Hip-Hop genre classification',
      },
      {
        name: 'High Tempo Electronic',
        audioUrl: 'https://example.com/test-audio/electronic-fast.mp3',
        expectedTempo: 128,
        expectedDuration: 240,
        expectedGenre: 'Electronic',
        expectedMood: 'Energetic',
        description: 'Test high tempo electronic music analysis',
      },
      {
        name: 'Slow Jazz',
        audioUrl: 'https://example.com/test-audio/jazz-slow.mp3',
        expectedTempo: 72,
        expectedDuration: 300,
        expectedGenre: 'Jazz',
        expectedMood: 'Relaxed',
        description: 'Test slow tempo jazz analysis',
      },
    ];
  }

  /**
   * Run validation tests
   */
  async runValidation(): Promise<ValidationResult[]> {
    const testCases = this.getTestCases();
    const results: ValidationResult[] = [];

    this.logger.log(`Starting validation with ${testCases.length} test cases`);
    this.logger.log('='.repeat(80));

    for (const testCase of testCases) {
      this.logger.log(`\nRunning test: ${testCase.name}`);
      this.logger.log(`Description: ${testCase.description}`);
      this.logger.log(
        `Expected - Tempo: ${testCase.expectedTempo} BPM, Duration: ${this.formatDuration(testCase.expectedDuration)}`,
      );

      const result = await this.runSingleTest(testCase);
      results.push(result);

      // Log result
      if (result.passed) {
        this.logger.log(`✅ PASSED - ${testCase.name}`);
      } else {
        this.logger.error(`❌ FAILED - ${testCase.name}`);
        if (result.error) {
          this.logger.error(`   Error: ${result.error}`);
        }
      }

      this.logger.log(
        `   Tempo: ${result.results.tempo.detected} BPM (expected ${result.results.tempo.expected} ±${this.TEMPO_TOLERANCE})`,
      );
      this.logger.log(
        `   Duration: ${this.formatDuration(result.results.duration.detected)} (expected ${this.formatDuration(result.results.duration.expected)} ±${this.DURATION_TOLERANCE}s)`,
      );

      if (result.results.genre) {
        this.logger.log(
          `   Genre: ${result.results.genre.detected} (confidence: ${(result.results.genre.confidence * 100).toFixed(1)}%)`,
        );
      }

      if (result.results.mood) {
        this.logger.log(
          `   Mood: ${result.results.mood.detected} (confidence: ${(result.results.mood.confidence * 100).toFixed(1)}%)`,
        );
      }

      this.logger.log(`   Processing time: ${result.processingTime}ms`);
    }

    return results;
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(testCase: TestCase): Promise<ValidationResult> {
    const startTime = Date.now();
    const uploadId = `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Run analysis with timeout
      const analysisPromise = this.audioAnalyzer.analyzeFromUrl(
        testCase.audioUrl,
        uploadId,
      );
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Analysis timeout')),
          this.MAX_PROCESSING_TIME,
        );
      });

      const analysisResult = (await Promise.race([
        analysisPromise,
        timeoutPromise,
      ])) as AnalysisResult;
      const processingTime = Date.now() - startTime;

      // Validate tempo
      const tempoWithinTolerance =
        Math.abs(analysisResult.tempo - testCase.expectedTempo) <=
        this.TEMPO_TOLERANCE;

      // Validate duration
      const durationWithinTolerance =
        Math.abs(analysisResult.duration - testCase.expectedDuration) <=
        this.DURATION_TOLERANCE;

      // Overall pass/fail
      const passed =
        tempoWithinTolerance &&
        durationWithinTolerance &&
        processingTime <= this.MAX_PROCESSING_TIME;

      return {
        testCase: testCase.name,
        passed,
        results: {
          tempo: {
            detected: analysisResult.tempo,
            expected: testCase.expectedTempo,
            withinTolerance: tempoWithinTolerance,
            tolerance: this.TEMPO_TOLERANCE,
          },
          duration: {
            detected: analysisResult.duration,
            expected: testCase.expectedDuration,
            withinTolerance: durationWithinTolerance,
            tolerance: this.DURATION_TOLERANCE,
          },
          genre: {
            detected: analysisResult.genre,
            expected: testCase.expectedGenre,
            confidence: analysisResult.genreConfidence,
          },
          mood: {
            detected: analysisResult.mood,
            expected: testCase.expectedMood,
            confidence:
              analysisResult.moodTags && analysisResult.moodTags.length > 0
                ? 0.8
                : 0.5, // Mock confidence
          },
        },
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        testCase: testCase.name,
        passed: false,
        results: {
          tempo: {
            detected: 0,
            expected: testCase.expectedTempo,
            withinTolerance: false,
            tolerance: this.TEMPO_TOLERANCE,
          },
          duration: {
            detected: 0,
            expected: testCase.expectedDuration,
            withinTolerance: false,
            tolerance: this.DURATION_TOLERANCE,
          },
        },
        processingTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate validation report
   */
  generateReport(results: ValidationResult[]): string {
    const passedTests = results.filter((r) => r.passed).length;
    const totalTests = results.length;
    const passRate = (passedTests / totalTests) * 100;

    let report = '\n' + '='.repeat(80) + '\n';
    report += 'AUDIO ANALYSIS ACCURACY VALIDATION REPORT\n';
    report += '='.repeat(80) + '\n';
    report += `Date: ${new Date().toISOString()}\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${totalTests - passedTests}\n`;
    report += `Pass Rate: ${passRate.toFixed(1)}%\n`;
    report += '\n';

    // Requirements validation
    report += 'REQUIREMENTS VALIDATION:\n';
    report += '-'.repeat(40) + '\n';

    const primaryTest = results.find((r) => r.testCase.includes('97 BPM'));
    if (primaryTest) {
      report += `✓ 97 BPM Detection: ${primaryTest.results.tempo.withinTolerance ? 'PASSED' : 'FAILED'}\n`;
      report += `  Detected: ${primaryTest.results.tempo.detected} BPM (±${this.TEMPO_TOLERANCE} tolerance)\n`;
      report += `✓ 3:20 Duration: ${primaryTest.results.duration.withinTolerance ? 'PASSED' : 'FAILED'}\n`;
      report += `  Detected: ${this.formatDuration(primaryTest.results.duration.detected)} (±${this.DURATION_TOLERANCE}s tolerance)\n`;
    }

    // Performance validation
    const avgProcessingTime =
      results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    const maxProcessingTime = Math.max(...results.map((r) => r.processingTime));
    report += `✓ Performance: ${maxProcessingTime <= this.MAX_PROCESSING_TIME ? 'PASSED' : 'FAILED'}\n`;
    report += `  Average processing time: ${avgProcessingTime.toFixed(0)}ms\n`;
    report += `  Maximum processing time: ${maxProcessingTime}ms (limit: ${this.MAX_PROCESSING_TIME}ms)\n`;

    report += '\n';

    // Detailed results
    report += 'DETAILED RESULTS:\n';
    report += '-'.repeat(40) + '\n';

    for (const result of results) {
      report += `\n${result.testCase}: ${result.passed ? 'PASSED' : 'FAILED'}\n`;

      if (result.error) {
        report += `  Error: ${result.error}\n`;
      } else {
        report += `  Tempo: ${result.results.tempo.detected} BPM (expected ${result.results.tempo.expected})\n`;
        report += `  Duration: ${this.formatDuration(result.results.duration.detected)} (expected ${this.formatDuration(result.results.duration.expected)})\n`;

        if (result.results.genre) {
          report += `  Genre: ${result.results.genre.detected} (confidence: ${(result.results.genre.confidence * 100).toFixed(1)}%)\n`;
        }

        if (result.results.mood) {
          report += `  Mood: ${result.results.mood.detected}\n`;
        }
      }

      report += `  Processing time: ${result.processingTime}ms\n`;
    }

    // Recommendations
    report += '\n';
    report += 'RECOMMENDATIONS:\n';
    report += '-'.repeat(40) + '\n';

    if (passRate < 80) {
      report += '⚠️  Pass rate below 80% - investigate failed test cases\n';
    }

    if (maxProcessingTime > this.MAX_PROCESSING_TIME * 0.8) {
      report +=
        '⚠️  Processing time approaching limit - consider optimization\n';
    }

    const genreAccuracy = results.filter(
      (r) =>
        r.results.genre?.expected &&
        r.results.genre.detected === r.results.genre.expected,
    ).length;

    if (genreAccuracy < totalTests * 0.7) {
      report +=
        '⚠️  Genre classification accuracy below 70% - review classification logic\n';
    }

    if (passRate >= 90) {
      report += '✅ Excellent accuracy - ready for production deployment\n';
    } else if (passRate >= 80) {
      report += '✅ Good accuracy - minor improvements recommended\n';
    } else {
      report +=
        '❌ Poor accuracy - significant improvements needed before deployment\n';
    }

    return report;
  }

  /**
   * Format duration in MM:SS format
   */
  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Save report to file
   */
  saveReport(report: string, filename: string = 'validation-report.txt'): void {
    const reportsDir = path.join(process.cwd(), 'reports');

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, report);

    this.logger.log(`Report saved to: ${filePath}`);
  }
}

/**
 * Main validation function
 */
async function runValidation() {
  const logger = new Logger('ValidationScript');

  try {
    logger.log('Initializing NestJS application...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const audioAnalyzer = app.get(AudioAnalyzerService);
    const validator = new AnalysisValidator(audioAnalyzer);

    logger.log('Starting audio analysis accuracy validation...');
    const results = await validator.runValidation();

    // Generate and display report
    const report = validator.generateReport(results);
    console.log(report);

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    validator.saveReport(report, `validation-report-${timestamp}.txt`);

    // Exit with appropriate code
    const passedTests = results.filter((r) => r.passed).length;
    const passRate = (passedTests / results.length) * 100;

    if (passRate >= 80) {
      logger.log('✅ Validation completed successfully');
      process.exit(0);
    } else {
      logger.error(
        '❌ Validation failed - accuracy below acceptable threshold',
      );
      process.exit(1);
    }
  } catch (error) {
    logger.error('Validation script failed:', error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  runValidation().catch(console.error);
}

export { AnalysisValidator };
export type { ValidationResult, TestCase };
