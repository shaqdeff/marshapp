import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class PasswordValidationService {
  private readonly commonWeakPasswords = [
    'password',
    'password123',
    '123456',
    '12345678',
    'qwerty',
    'abc123',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
    'weak',
    'test',
    'admin',
    'user',
  ];

  private readonly commonPatterns = [
    /^(.)\1+$/, // All same character (e.g., "aaaaaaaa")
    /^123+/, // Sequential numbers starting with 123
    /^abc+/i, // Sequential letters starting with abc
    /^qwerty/i, // Keyboard patterns
    /^password/i, // Starts with "password"
  ];

  validatePassword(password: string, email?: string, name?: string): void {
    // Check against common weak passwords
    if (this.commonWeakPasswords.includes(password.toLowerCase())) {
      throw new BadRequestException(
        'This password is too common and easily guessed. Please choose a stronger password.',
      );
    }

    // Check against common patterns
    for (const pattern of this.commonPatterns) {
      if (pattern.test(password)) {
        throw new BadRequestException(
          'Password contains a common pattern. Please choose a more complex password.',
        );
      }
    }

    // Check if password contains email or name
    if (
      email &&
      password.toLowerCase().includes(email.split('@')[0].toLowerCase())
    ) {
      throw new BadRequestException(
        'Password should not contain your email address.',
      );
    }

    if (
      name &&
      name.length > 2 &&
      password.toLowerCase().includes(name.toLowerCase())
    ) {
      throw new BadRequestException('Password should not contain your name.');
    }

    // Check for minimum complexity score
    const complexityScore = this.calculateComplexityScore(password);
    if (complexityScore < 4) {
      throw new BadRequestException(
        'Password is not complex enough. Please use a mix of uppercase, lowercase, numbers, and special characters.',
      );
    }
  }

  private calculateComplexityScore(password: string): number {
    let score = 0;

    // Length bonus
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;

    // Character type bonuses
    if (/[a-z]/.test(password)) score += 1; // lowercase
    if (/[A-Z]/.test(password)) score += 1; // uppercase
    if (/\d/.test(password)) score += 1; // numbers
    if (/[@$!%*?&]/.test(password)) score += 1; // special chars
    if (/[^a-zA-Z0-9@$!%*?&]/.test(password)) score += 1; // other special chars

    // Diversity bonus (no repeated sequences)
    if (!/(.{3,})\1/.test(password)) score += 1;

    return score;
  }
}
