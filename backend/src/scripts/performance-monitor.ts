#!/usr/bin/env ts-node

/**
 * Performance monitoring script for audio analysis system
 * Monitors performance metrics and error rates as required by task 15
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AudioAnalyzerService } from '../analysis/audio-analyzer.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetrics {
  timestamp: Date;
  testName: string;
  processingTime: number;
  memoryUsage: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  audioUrl: string;
  fileSize?: number;
  tempo?: number;
  duration?: number;
}

interface PerformanceReport {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  successRate: number;
  averageProcessingTime: number;
  maxProcessingTime: number;
  minProcessingTime: number;
  averageMemoryUsage: number;
  maxMemoryUsage: number;
  errorBreakdown: Record<string, number>;
  performanceThresholds: {
    processingTimeLimit: number;
    memoryLimit: number;
    successRateThreshold: number;
  };
  recommendations: string[];
}

class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  private metrics: PerformanceMetrics[] = [];

  // Performance thresholds from requirements
  private readonly PROCESSING_TIME_LIMIT = 30000; // 30 seconds
  private readonly MEMORY_LIMIT = 512; // 512MB
  private readonly SUCCESS_RATE_THRESHOLD = 95; // 95% success rate
  private readonly CONCURRENT_TESTS = 5; // Test concurrent processing

  constructor(private audioAnalyzer: AudioAnalyzerService) {}

  /**
   * Test URLs for performance monitoring
   */
  private getTestUrls(): Array<{ url: string; description: string }> {
    return [
      {
        url: 'https://example.com/test-audio/small-file.mp3',
        description: 'Small file (2MB, 2 minutes)',
      },
      {
        url: 'https://example.com/test-audio/medium-file.mp3',
        description: 'Medium file (5MB, 4 minutes)',
      },
      {
        url: 'https://example.com/test-audio/large-file.mp3',
        description: 'Large file (10MB, 6 minutes)',
      },
      {
        url: 'https://example.com/test-audio/high-quality.wav',
        description: 'High quality WAV file',
      },
      {
        url: 'https://example.com/test-audio/compressed.mp3',
        description: 'Highly compressed MP3',
      },
    ];
  }

  /**
   * Run performance monitoring tests
   */
  async runPerformanceTests(): Promise<PerformanceReport> {
    this.logger.log('Starting performance monitoring tests...');
    this.metrics = [];

    // Run sequential tests
    await this.runSequentialTests();

    // Run concurrent tests
    await this.runConcurrentTests();

    // Run stress tests
    await this.runStressTests();

    // Generate report
    return this.generateReport();
  }

  /**
   * Run sequential performance tests
   */
  private async runSequentialTests(): Promise<void> {
    this.logger.log('Running sequential performance tests...');
    const testUrls = this.getTestUrls();

    for (const testUrl of testUrls) {
      this.logger.log(`Testing: ${testUrl.description}`);
      await this.runSinglePerformanceTest(
        testUrl.url,
        `Sequential - ${testUrl.description}`,
      );

      // Wait between tests to avoid overwhelming the system
      await this.sleep(1000);
    }
  }

  /**
   * Run concurrent performance tests
   */
  private async runConcurrentTests(): Promise<void> {
    this.logger.log(
      `Running concurrent performance tests (${this.CONCURRENT_TESTS} simultaneous)...`,
    );
    const testUrls = this.getTestUrls();

    // Create concurrent test promises
    const concurrentPromises = Array(this.CONCURRENT_TESTS)
      .fill(null)
      .map((_, index) => {
        const testUrl = testUrls[index % testUrls.length];
        return this.runSinglePerformanceTest(
          testUrl.url,
          `Concurrent-${index + 1} - ${testUrl.description}`,
        );
      });

    // Run all concurrent tests
    await Promise.allSettled(concurrentPromises);
  }

  /**
   * Run stress tests with rapid requests
   */
  private async runStressTests(): Promise<void> {
    this.logger.log('Running stress tests...');
    const testUrl = this.getTestUrls()[0]; // Use smallest file for stress test

    // Rapid fire tests
    const stressPromises = Array(10)
      .fill(null)
      .map((_, index) =>
        this.runSinglePerformanceTest(
          testUrl.url,
          `Stress-${index + 1} - ${testUrl.description}`,
        ),
      );

    await Promise.allSettled(stressPromises);
  }

  /**
   * Run a single performance test
   */
  private async runSinglePerformanceTest(
    audioUrl: string,
    testName: string,
  ): Promise<void> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const uploadId = `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let metrics: PerformanceMetrics = {
      timestamp: new Date(),
      testName,
      processingTime: 0,
      memoryUsage: startMemory,
      success: false,
      audioUrl,
    };

    try {
      // Run analysis with timeout
      const analysisPromise = this.audioAnalyzer.analyzeFromUrl(
        audioUrl,
        uploadId,
      );
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Performance test timeout')),
          this.PROCESSING_TIME_LIMIT + 5000,
        );
      });

      const result = (await Promise.race([
        analysisPromise,
        timeoutPromise,
      ])) as any;

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      metrics = {
        ...metrics,
        processingTime: endTime - startTime,
        memoryUsage: Math.max(startMemory, endMemory),
        success: true,
        tempo: result.tempo,
        duration: result.duration,
      };

      this.logger.log(
        `✅ ${testName}: ${metrics.processingTime}ms, ${metrics.memoryUsage.toFixed(1)}MB`,
      );
    } catch (error) {
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      metrics = {
        ...metrics,
        processingTime: endTime - startTime,
        memoryUsage: Math.max(startMemory, endMemory),
        success: false,
        errorType:
          error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      this.logger.error(
        `❌ ${testName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.metrics.push(metrics);
  }

  /**
   * Generate performance report
   */
  private generateReport(): PerformanceReport {
    const totalTests = this.metrics.length;
    const successfulTests = this.metrics.filter((m) => m.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = (successfulTests / totalTests) * 100;

    const processingTimes = this.metrics.map((m) => m.processingTime);
    const memoryUsages = this.metrics.map((m) => m.memoryUsage);

    const averageProcessingTime =
      processingTimes.reduce((sum, time) => sum + time, 0) / totalTests;
    const maxProcessingTime = Math.max(...processingTimes);
    const minProcessingTime = Math.min(...processingTimes);

    const averageMemoryUsage =
      memoryUsages.reduce((sum, mem) => sum + mem, 0) / totalTests;
    const maxMemoryUsage = Math.max(...memoryUsages);

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    this.metrics
      .filter((m) => !m.success)
      .forEach((m) => {
        const errorType = m.errorType || 'Unknown';
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      });

    // Generate recommendations
    const recommendations: string[] = [];

    if (successRate < this.SUCCESS_RATE_THRESHOLD) {
      recommendations.push(
        `Success rate (${successRate.toFixed(1)}%) is below threshold (${this.SUCCESS_RATE_THRESHOLD}%)`,
      );
    }

    if (averageProcessingTime > this.PROCESSING_TIME_LIMIT * 0.7) {
      recommendations.push(
        `Average processing time (${averageProcessingTime.toFixed(0)}ms) is approaching limit (${this.PROCESSING_TIME_LIMIT}ms)`,
      );
    }

    if (maxProcessingTime > this.PROCESSING_TIME_LIMIT) {
      recommendations.push(
        `Maximum processing time (${maxProcessingTime}ms) exceeds limit (${this.PROCESSING_TIME_LIMIT}ms)`,
      );
    }

    if (maxMemoryUsage > this.MEMORY_LIMIT) {
      recommendations.push(
        `Maximum memory usage (${maxMemoryUsage.toFixed(1)}MB) exceeds limit (${this.MEMORY_LIMIT}MB)`,
      );
    }

    if (Object.keys(errorBreakdown).length > 0) {
      recommendations.push(
        'Error types detected: ' + Object.keys(errorBreakdown).join(', '),
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance metrics within acceptable ranges');
    }

    return {
      totalTests,
      successfulTests,
      failedTests,
      successRate,
      averageProcessingTime,
      maxProcessingTime,
      minProcessingTime,
      averageMemoryUsage,
      maxMemoryUsage,
      errorBreakdown,
      performanceThresholds: {
        processingTimeLimit: this.PROCESSING_TIME_LIMIT,
        memoryLimit: this.MEMORY_LIMIT,
        successRateThreshold: this.SUCCESS_RATE_THRESHOLD,
      },
      recommendations,
    };
  }

  /**
   * Format and display performance report
   */
  displayReport(report: PerformanceReport): string {
    let output = '\n' + '='.repeat(80) + '\n';
    output += 'AUDIO ANALYSIS PERFORMANCE MONITORING REPORT\n';
    output += '='.repeat(80) + '\n';
    output += `Date: ${new Date().toISOString()}\n`;
    output += `Total Tests: ${report.totalTests}\n`;
    output += `Successful: ${report.successfulTests}\n`;
    output += `Failed: ${report.failedTests}\n`;
    output += `Success Rate: ${report.successRate.toFixed(1)}%\n`;
    output += '\n';

    // Performance metrics
    output += 'PERFORMANCE METRICS:\n';
    output += '-'.repeat(40) + '\n';
    output += `Average Processing Time: ${report.averageProcessingTime.toFixed(0)}ms\n`;
    output += `Maximum Processing Time: ${report.maxProcessingTime}ms\n`;
    output += `Minimum Processing Time: ${report.minProcessingTime}ms\n`;
    output += `Processing Time Limit: ${report.performanceThresholds.processingTimeLimit}ms\n`;
    output += '\n';
    output += `Average Memory Usage: ${report.averageMemoryUsage.toFixed(1)}MB\n`;
    output += `Maximum Memory Usage: ${report.maxMemoryUsage.toFixed(1)}MB\n`;
    output += `Memory Limit: ${report.performanceThresholds.memoryLimit}MB\n`;
    output += '\n';

    // Error breakdown
    if (Object.keys(report.errorBreakdown).length > 0) {
      output += 'ERROR BREAKDOWN:\n';
      output += '-'.repeat(40) + '\n';
      for (const [errorType, count] of Object.entries(report.errorBreakdown)) {
        output += `${errorType}: ${count} occurrences\n`;
      }
      output += '\n';
    }

    // Thresholds validation
    output += 'THRESHOLD VALIDATION:\n';
    output += '-'.repeat(40) + '\n';
    output += `✓ Success Rate: ${report.successRate >= report.performanceThresholds.successRateThreshold ? 'PASSED' : 'FAILED'}\n`;
    output += `✓ Processing Time: ${report.maxProcessingTime <= report.performanceThresholds.processingTimeLimit ? 'PASSED' : 'FAILED'}\n`;
    output += `✓ Memory Usage: ${report.maxMemoryUsage <= report.performanceThresholds.memoryLimit ? 'PASSED' : 'FAILED'}\n`;
    output += '\n';

    // Recommendations
    output += 'RECOMMENDATIONS:\n';
    output += '-'.repeat(40) + '\n';
    for (const recommendation of report.recommendations) {
      output += `• ${recommendation}\n`;
    }
    output += '\n';

    // Detailed metrics
    output += 'DETAILED TEST RESULTS:\n';
    output += '-'.repeat(40) + '\n';
    for (const metric of this.metrics) {
      const status = metric.success ? '✅' : '❌';
      output += `${status} ${metric.testName}\n`;
      output += `   Time: ${metric.processingTime}ms, Memory: ${metric.memoryUsage.toFixed(1)}MB\n`;
      if (!metric.success && metric.errorMessage) {
        output += `   Error: ${metric.errorMessage}\n`;
      }
      if (metric.success && metric.tempo && metric.duration) {
        output += `   Results: ${metric.tempo} BPM, ${this.formatDuration(metric.duration)}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Save performance metrics to JSON file
   */
  async saveMetrics(
    filename: string = 'performance-metrics.json',
  ): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(this.metrics, null, 2));

    this.logger.log(`Performance metrics saved to: ${filePath}`);
  }

  /**
   * Save performance report to file
   */
  async saveReport(
    report: string,
    filename: string = 'performance-report.txt',
  ): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, filename);
    fs.writeFileSync(filePath, report);

    this.logger.log(`Performance report saved to: ${filePath}`);
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
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Main performance monitoring function
 */
async function runPerformanceMonitoring() {
  const logger = new Logger('PerformanceMonitoring');

  try {
    logger.log('Initializing NestJS application...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const audioAnalyzer = app.get(AudioAnalyzerService);
    const monitor = new PerformanceMonitor(audioAnalyzer);

    logger.log('Starting performance monitoring...');
    const report = await monitor.runPerformanceTests();

    // Display and save report
    const reportText = monitor.displayReport(report);
    console.log(reportText);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await monitor.saveReport(reportText, `performance-report-${timestamp}.txt`);
    await monitor.saveMetrics(`performance-metrics-${timestamp}.json`);

    // Exit with appropriate code
    if (
      report.successRate >= report.performanceThresholds.successRateThreshold &&
      report.maxProcessingTime <=
        report.performanceThresholds.processingTimeLimit &&
      report.maxMemoryUsage <= report.performanceThresholds.memoryLimit
    ) {
      logger.log('✅ Performance monitoring completed successfully');
      process.exit(0);
    } else {
      logger.error('❌ Performance monitoring detected issues');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Performance monitoring failed:', error);
    process.exit(1);
  }
}

// Run monitoring if this script is executed directly
if (require.main === module) {
  runPerformanceMonitoring().catch(console.error);
}

export { PerformanceMonitor };
export type { PerformanceMetrics, PerformanceReport };
