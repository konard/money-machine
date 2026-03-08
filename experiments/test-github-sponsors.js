#!/usr/bin/env node
/**
 * Experiment: Test GitHub Sponsors Strategy
 *
 * This script tests the GitHub Sponsors strategy with real API calls.
 * It requires a GITHUB_TOKEN environment variable.
 *
 * Usage:
 *   GITHUB_TOKEN=your_token node experiments/test-github-sponsors.js [username]
 *
 * Or with environment variable already set:
 *   node experiments/test-github-sponsors.js octocat
 */

import { GitHubSponsorsStrategy } from '../src/strategies/github-sponsors.js';
import { Logger } from '../src/core/logger.js';
import { RateLimiter } from '../src/core/rate-limiter.js';
import { ComplianceEngine } from '../src/core/compliance-engine.js';

async function main() {
  const login = process.argv[2] || process.env.GITHUB_REPOSITORY_OWNER;

  console.log('='.repeat(60));
  console.log('GitHub Sponsors Strategy - Live Test');
  console.log('='.repeat(60));
  console.log();

  // Check prerequisites
  if (!process.env.GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error(
      '  GITHUB_TOKEN=your_token node experiments/test-github-sponsors.js [username]'
    );
    console.error('');
    console.error(
      'Get a token at: https://github.com/settings/tokens?type=beta'
    );
    console.error('Required scopes: read:user');
    process.exit(1);
  }

  if (!login) {
    console.error('Error: GitHub username is required');
    console.error('');
    console.error('Usage:');
    console.error(
      '  GITHUB_TOKEN=your_token node experiments/test-github-sponsors.js <username>'
    );
    process.exit(1);
  }

  console.log(`Testing with GitHub user: ${login}`);
  console.log();

  // Create dependencies
  const logger = new Logger({ level: 'info' });
  const rateLimiter = new RateLimiter();
  const complianceEngine = new ComplianceEngine({}, logger, rateLimiter);

  // Create and initialize strategy
  const strategy = new GitHubSponsorsStrategy();
  strategy.initialize({
    logger,
    complianceEngine,
    config: {
      githubToken: process.env.GITHUB_TOKEN,
      login,
      isOrganization: false,
    },
  });

  console.log('Strategy initialized successfully');
  console.log();

  // Validate configuration
  console.log('Validating configuration...');
  const validation = strategy.validate({
    config: {
      githubToken: process.env.GITHUB_TOKEN,
      login,
    },
  });

  if (!validation.valid) {
    console.error('Validation failed:', validation.errors);
    process.exit(1);
  }
  console.log('Validation passed');
  console.log();

  // Execute strategy
  console.log('Executing strategy (fetching sponsors data)...');
  console.log();

  const result = await strategy.execute({});

  if (result.success) {
    console.log('='.repeat(60));
    console.log('SUCCESS - Sponsors Data Retrieved');
    console.log('='.repeat(60));
    console.log();

    console.log('Summary:');
    console.log(`  Has Sponsors Listing: ${result.hasSponsorsListing}`);
    console.log(`  Sponsor Count: ${result.sponsorCount}`);
    console.log(`  Active Sponsorships: ${result.activeSponsorships}`);
    console.log();

    console.log('Earnings:');
    console.log(`  Monthly Income: $${result.earnings?.toFixed(2) || '0.00'}`);
    console.log(`  Monthly Income (cents): ${result.earningsCents || 0} cents`);
    console.log(
      `  Recurring Monthly: $${result.recurringMonthlyIncome?.toFixed(2) || '0.00'}`
    );
    console.log(`  Currency: ${result.currency}`);
    console.log();

    if (result.goal) {
      console.log('Sponsorship Goal:');
      console.log(`  Title: ${result.goal.title}`);
      console.log(`  Progress: ${result.goal.percentComplete}%`);
      console.log(`  Target: ${result.goal.targetValue}`);
      console.log();
    }

    console.log(`Message: ${result.message}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log();

    // Verification data for audit trail
    console.log('Verification Data:');
    console.log(`  Login verified: ${result.verificationData?.login}`);
    console.log(`  Fetched at: ${result.verificationData?.fetchedAt}`);
    console.log();

    // Check if actually earning
    if (result.earnings && result.earnings > 0) {
      console.log('='.repeat(60));
      console.log('EARNINGS DETECTED!');
      console.log('='.repeat(60));
      console.log(
        `This account is earning $${result.earnings.toFixed(2)}/month`
      );
      console.log('through GitHub Sponsors.');
      console.log();
      console.log('To verify this reaches your bank account:');
      console.log('1. Go to https://github.com/sponsors/dashboard');
      console.log('2. Check "Payment history" tab');
      console.log('3. Verify Stripe/bank account is connected');
    } else {
      console.log('='.repeat(60));
      console.log('NO EARNINGS YET');
      console.log('='.repeat(60));
      console.log('To start earning with GitHub Sponsors:');
      console.log('1. Enable GitHub Sponsors at https://github.com/sponsors');
      console.log('2. Create sponsor tiers');
      console.log('3. Add sponsor buttons to your repositories');
      console.log('4. Create valuable open source projects');
    }
  } else {
    console.log('='.repeat(60));
    console.log('FAILED - Could not retrieve sponsors data');
    console.log('='.repeat(60));
    console.log();
    console.log(`Error: ${result.error}`);
    console.log(`Error Code: ${result.errorCode || 'N/A'}`);
    console.log(`Hint: ${result.hint}`);
  }

  // Get final status
  console.log();
  console.log('Strategy Status:');
  const status = strategy.getStatus();
  console.log(`  Name: ${status.name}`);
  console.log(`  Status: ${status.status}`);
  console.log(`  Actions: ${status.actions}`);
  console.log(`  Errors: ${status.errorCount}`);

  // Cleanup
  strategy.shutdown();
  console.log();
  console.log('Strategy shut down successfully');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
