/**
 * Compliance Engine - Ensures all actions comply with laws and platform rules
 *
 * Pre-validates actions against platform ToS, rate limits, and legal requirements
 */

export class ComplianceEngine {
  constructor(config = {}, logger = null, rateLimiter = null) {
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.strictMode = config.strictMode !== false;
    this.rules = this.loadRules();
    this.violations = [];

    this.log('Compliance engine initialized', { strictMode: this.strictMode });
  }

  log(message, context = {}) {
    if (this.logger) {
      this.logger.debug(`[Compliance] ${message}`, context);
    }
  }

  /**
   * Load platform rules and legal requirements
   * @private
   */
  loadRules() {
    return {
      platforms: {
        github: {
          requiresUserAgent: true,
          noAutomatedAccounts: true,
          rateLimit: true,
        },
        fiverr: {
          oneAccountPerPerson: true,
          noAutomatedCommunication: true,
          deliverAsDescribed: true,
        },
        upwork: {
          realIndividualsOnly: true,
          noAutomatedBidding: true,
          personalCommunication: true,
        },
      },
      legal: {
        noUnauthorizedAccess: true,
        noFraud: true,
        respectIntellectualProperty: true,
        dataPrivacy: true,
        noSpam: true,
      },
    };
  }

  /**
   * Check if action complies with all rules
   * @param {object} action - Action to check
   * @param {object} context - Action context
   * @returns {Promise<object>} Compliance check result
   */
  async checkAction(action, context = {}) {
    const checks = [];

    // 1. Legal check
    const legalCheck = this.checkLegal(action);
    checks.push(legalCheck);

    // 2. Platform rules check
    if (context.platform) {
      const platformCheck = this.checkPlatformRules(context.platform, action);
      checks.push(platformCheck);
    }

    // 3. Rate limit check
    if (context.platform && this.rateLimiter) {
      const rateLimitCheck = await this.checkRateLimit(
        context.platform,
        action.type
      );
      checks.push(rateLimitCheck);
    }

    // 4. Required disclosures check
    if (this.requiresDisclosure(action)) {
      const disclosureCheck = this.checkDisclosure(action);
      checks.push(disclosureCheck);
    }

    const allPassed = checks.every((check) => check.passed);
    const result = {
      passed: allPassed,
      checks,
      action: action.type,
      timestamp: new Date().toISOString(),
    };

    if (!allPassed) {
      this.violations.push(result);
      this.log('Compliance check FAILED', result);

      if (this.strictMode) {
        throw new ComplianceError('Action violates compliance rules', result);
      }
    } else {
      this.log('Compliance check passed', { action: action.type });
    }

    return result;
  }

  /**
   * Check legal compliance
   * @private
   */
  checkLegal(action) {
    const violations = [];

    // Check against known illegal actions
    if (action.type === 'unauthorized-access') {
      violations.push('Unauthorized access is illegal');
    }
    if (action.type === 'fraud' || action.fraudulent) {
      violations.push('Fraudulent activity is illegal');
    }
    if (action.type === 'spam' && !action.userConsent) {
      violations.push('Spam without consent violates anti-spam laws');
    }

    return {
      category: 'legal',
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Check platform-specific rules
   * @private
   */
  checkPlatformRules(platform, action) {
    const rules = this.rules.platforms[platform];
    const violations = [];

    if (!rules) {
      return {
        category: 'platform',
        passed: true,
        violations: [],
        note: `No specific rules loaded for ${platform}`,
      };
    }

    // Check specific platform rules
    if (rules.noAutomatedCommunication && action.type === 'send-message') {
      if (!action.personalResponse) {
        violations.push(
          `${platform} requires personal communication, not automated`
        );
      }
    }

    if (rules.noAutomatedBidding && action.type === 'submit-proposal') {
      if (action.automated) {
        violations.push(`${platform} does not allow automated bidding`);
      }
    }

    return {
      category: 'platform',
      platform,
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Check rate limit compliance
   * @private
   */
  async checkRateLimit(platform, actionType) {
    if (!this.rateLimiter) {
      return {
        category: 'rateLimit',
        passed: true,
        note: 'No rate limiter configured',
      };
    }

    const canProceed = await this.rateLimiter.acquireToken(
      platform,
      actionType
    );

    if (!canProceed) {
      const remaining = this.rateLimiter.getRemainingQuota(platform);
      return {
        category: 'rateLimit',
        passed: false,
        violations: ['Rate limit exceeded'],
        remaining,
      };
    }

    return {
      category: 'rateLimit',
      passed: true,
    };
  }

  /**
   * Check if action requires disclosure
   * @private
   */
  requiresDisclosure(action) {
    return (
      action.type === 'post-affiliate-link' ||
      action.type === 'sponsored-content' ||
      action.affiliate ||
      action.sponsored
    );
  }

  /**
   * Check disclosure compliance
   * @private
   */
  checkDisclosure(action) {
    const violations = [];

    if (this.requiresDisclosure(action) && !action.hasDisclosure) {
      violations.push(
        'Required disclosure missing for affiliate/sponsored content'
      );
    }

    return {
      category: 'disclosure',
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * Log action for audit trail
   * @param {object} action - Action performed
   * @param {object} result - Action result
   * @param {object} context - Context
   */
  logAction(action, result, context = {}) {
    if (this.logger) {
      this.logger.audit(action.type, result, {
        platform: context.platform,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate compliance report
   * @returns {object} Compliance report
   */
  generateComplianceReport() {
    return {
      totalViolations: this.violations.length,
      violations: [...this.violations],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear violations history
   */
  clearViolations() {
    this.violations = [];
  }
}

/**
 * Custom error for compliance violations
 */
export class ComplianceError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ComplianceError';
    this.details = details;
  }
}
