/**
 * Rate Limiter - Token bucket rate limiting for platform APIs
 *
 * Prevents exceeding platform rate limits by tracking and controlling
 * request rates per platform.
 */

export class RateLimiter {
  constructor(config = {}, logger = null) {
    this.logger = logger;
    this.platforms = new Map();

    // Default rate limits (can be overridden per platform)
    this.defaultLimits = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10,
    };

    // Platform-specific limits
    this.platformLimits = config.platformLimits || {};

    this.log('Rate limiter initialized');
  }

  /**
   * Log helper
   * @private
   */
  log(message, context = {}) {
    if (this.logger) {
      this.logger.debug(`[RateLimiter] ${message}`, context);
    }
  }

  /**
   * Get or create platform state
   * @private
   */
  getPlatformState(platform) {
    if (!this.platforms.has(platform)) {
      const limits = this.platformLimits[platform] || { ...this.defaultLimits };

      this.platforms.set(platform, {
        limits,
        tokens: {
          minute: limits.requestsPerMinute,
          hour: limits.requestsPerHour,
          burst: limits.burstLimit,
        },
        lastRefill: {
          minute: Date.now(),
          hour: Date.now(),
        },
        queue: [],
      });
    }
    return this.platforms.get(platform);
  }

  /**
   * Refill tokens based on time elapsed
   * @private
   */
  refillTokens(state) {
    const now = Date.now();

    // Refill minute tokens
    const minutesSince = (now - state.lastRefill.minute) / 60000;
    if (minutesSince >= 1) {
      const refillAmount = Math.floor(
        minutesSince * state.limits.requestsPerMinute
      );
      state.tokens.minute = Math.min(
        state.limits.requestsPerMinute,
        state.tokens.minute + refillAmount
      );
      state.lastRefill.minute = now;
    }

    // Refill hour tokens
    const hoursSince = (now - state.lastRefill.hour) / 3600000;
    if (hoursSince >= 1) {
      const refillAmount = Math.floor(
        hoursSince * state.limits.requestsPerHour
      );
      state.tokens.hour = Math.min(
        state.limits.requestsPerHour,
        state.tokens.hour + refillAmount
      );
      state.lastRefill.hour = now;
    }

    // Burst tokens refill more slowly
    if (state.tokens.burst < state.limits.burstLimit) {
      const burstRefillRate = state.limits.burstLimit / 300; // Refill over 5 minutes
      const burstRefill = minutesSince * burstRefillRate;
      state.tokens.burst = Math.min(
        state.limits.burstLimit,
        state.tokens.burst + burstRefill
      );
    }
  }

  /**
   * Acquire token for a platform action
   * @param {string} platform - Platform name
   * @param {string} actionType - Optional action type for logging
   * @returns {boolean} True if token acquired
   */
  acquireToken(platform, actionType = 'request') {
    const state = this.getPlatformState(platform);
    this.refillTokens(state);

    // Check if tokens available
    if (
      state.tokens.minute > 0 &&
      state.tokens.hour > 0 &&
      state.tokens.burst > 0
    ) {
      state.tokens.minute--;
      state.tokens.hour--;
      state.tokens.burst--;

      this.log('Token acquired', {
        platform,
        actionType,
        remaining: state.tokens,
      });

      return true;
    }

    // No tokens available - would need to wait
    this.log('Rate limit reached', {
      platform,
      actionType,
      remaining: state.tokens,
    });

    return false;
  }

  /**
   * Release token back (for cancelled operations)
   * @param {string} platform - Platform name
   * @param {string} actionType - Optional action type
   */
  releaseToken(platform, actionType = 'request') {
    const state = this.getPlatformState(platform);

    state.tokens.minute = Math.min(
      state.limits.requestsPerMinute,
      state.tokens.minute + 1
    );
    state.tokens.hour = Math.min(
      state.limits.requestsPerHour,
      state.tokens.hour + 1
    );
    state.tokens.burst = Math.min(
      state.limits.burstLimit,
      state.tokens.burst + 1
    );

    this.log('Token released', { platform, actionType });
  }

  /**
   * Get remaining quota for platform
   * @param {string} platform - Platform name
   * @returns {object} Remaining tokens
   */
  getRemainingQuota(platform) {
    const state = this.getPlatformState(platform);
    this.refillTokens(state);
    return { ...state.tokens };
  }

  /**
   * Get reset time for next token refill
   * @param {string} platform - Platform name
   * @returns {object} Reset times
   */
  getResetTime(platform) {
    const state = this.getPlatformState(platform);
    const now = Date.now();

    return {
      minute: new Date(state.lastRefill.minute + 60000),
      hour: new Date(state.lastRefill.hour + 3600000),
      minutesUntilMinuteReset: Math.ceil(
        (state.lastRefill.minute + 60000 - now) / 60000
      ),
      minutesUntilHourReset: Math.ceil(
        (state.lastRefill.hour + 3600000 - now) / 60000
      ),
    };
  }

  /**
   * Wait for token availability
   * @param {string} platform - Platform name
   * @param {number} maxWaitMs - Maximum wait time in milliseconds
   * @returns {Promise<boolean>} True if token acquired, false if timeout
   */
  async waitForToken(platform, maxWaitMs = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquireToken(platform)) {
        return true;
      }

      // Wait before checking again
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
    }

    this.log('Wait for token timeout', { platform, maxWaitMs });
    return false;
  }

  /**
   * Set custom limits for a platform
   * @param {string} platform - Platform name
   * @param {object} limits - Rate limits
   */
  setPlatformLimits(platform, limits) {
    this.platformLimits[platform] = { ...this.defaultLimits, ...limits };

    // Update existing state if present
    if (this.platforms.has(platform)) {
      const state = this.platforms.get(platform);
      state.limits = this.platformLimits[platform];
    }

    this.log('Platform limits updated', { platform, limits });
  }

  /**
   * Get all platform states
   * @returns {object} Platform states
   */
  getStats() {
    const stats = {};

    for (const [platform, state] of this.platforms.entries()) {
      this.refillTokens(state);
      stats[platform] = {
        limits: state.limits,
        remaining: state.tokens,
        lastRefill: state.lastRefill,
      };
    }

    return stats;
  }

  /**
   * Reset all rate limiters
   */
  reset() {
    this.platforms.clear();
    this.log('Rate limiters reset');
  }
}
