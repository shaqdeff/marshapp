import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class EmailValidationService {
  // List of common disposable email domains to block
  private readonly disposableEmailDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'yopmail.com',
    'throwaway.email',
    'temp-mail.org',
    'getnada.com',
    'maildrop.cc',
    'sharklasers.com',
    'guerrillamailblock.com',
    'pokemail.net',
    'spam4.me',
    'bccto.me',
    'chacuo.net',
    'dispostable.com',
    'fakeinbox.com',
    'hide.biz.st',
    'mytrashmail.com',
    'nobulk.com',
    'sogetthis.com',
    'spamherelots.com',
    'spamhereplease.com',
    'spamthisplease.com',
    'superrito.com',
    'trashymail.com',
    'wegwerfmail.de',
    'wegwerfmail.net',
    'wegwerfmail.org',
    'wh4f.org',
  ];

  // List of trusted email domains
  private readonly trustedDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'protonmail.com',
    'aol.com',
    'live.com',
    'msn.com',
    'yandex.com',
    'mail.com',
    'zoho.com',
  ];

  /**
   * Validates if an email address is legitimate and not from a disposable email service
   */
  validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Email is required');
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    const domain = email.toLowerCase().split('@')[1];

    // Check if it's a disposable email domain
    if (this.disposableEmailDomains.includes(domain)) {
      throw new BadRequestException(
        'Disposable email addresses are not allowed. Please use a permanent email address.',
      );
    }

    // Additional checks for suspicious patterns
    this.checkSuspiciousPatterns(email, domain);
  }

  /**
   * Checks for suspicious email patterns that might indicate spam
   */
  private checkSuspiciousPatterns(email: string, domain: string): void {
    const localPart = email.split('@')[0].toLowerCase();

    // Check for excessive numbers (might indicate generated emails)
    const numberCount = (localPart.match(/\d/g) || []).length;
    if (numberCount > 8) {
      throw new BadRequestException(
        'Email address appears to be automatically generated. Please use a personal email.',
      );
    }

    // Check for suspicious domain patterns
    if (
      domain.includes('temp') ||
      domain.includes('disposable') ||
      domain.includes('trash')
    ) {
      throw new BadRequestException(
        'Temporary email addresses are not allowed. Please use a permanent email address.',
      );
    }

    // Check for very short domains (often used by disposable services)
    const domainParts = domain.split('.');
    if (domainParts.length === 2 && domainParts[0].length <= 3) {
      // Allow some common short domains
      const allowedShortDomains = ['me.com', 'qq.com', 'vk.com'];
      if (!allowedShortDomains.includes(domain)) {
        throw new BadRequestException(
          'Please use a well-established email provider for account registration.',
        );
      }
    }
  }

  /**
   * Checks if an email domain is from a trusted provider
   */
  isTrustedDomain(email: string): boolean {
    const domain = email.toLowerCase().split('@')[1];
    return this.trustedDomains.includes(domain);
  }

  /**
   * Gets a user-friendly suggestion for email providers
   */
  getEmailProviderSuggestion(): string {
    return 'Please use a permanent email address from providers like Gmail, Yahoo, Outlook, or your organization email.';
  }
}
