# Money Machine — Strategy Requirements

This document defines the requirements that every money-making strategy in this project must satisfy.

## Core Principle: Full Cycle Coverage

**A strategy is only accepted if it covers the complete end-to-end money cycle:**

```
Setup → Execute → Earn → Receive money in a real bank account
```

Strategies that only cover part of this cycle (e.g., monitoring earnings without a path to actually receiving them) are **not accepted**.

## Requirements for Every Strategy

### 1. Step-by-Step Execution Guide

Every strategy must provide a complete, ordered list of steps that:

- Are **small and atomic** — each step does exactly one thing
- Are **simple enough for a child to follow** — no assumed knowledge
- Cover the **full cycle** from zero to money in a bank account
- Clearly mark which steps are **manual** and which are **automated**

### 2. Automation of Automatable Steps

Every step that can be automated **must** be automated. This means:

- A user can trigger automated steps by clicking a single button (e.g., a GitHub Actions "Run workflow" button)
- Automated steps must be executable without human intervention once triggered
- The strategy implementation must include the actual automation code, not just documentation

### 3. Manual Steps Must Be Explicitly Documented

For steps that require human action (e.g., signing up on a platform, entering bank details):

- List the exact URL to visit
- List the exact actions to take (click this button, fill in this field)
- Provide screenshots or examples where helpful
- Explain why the step cannot be automated (if applicable)

### 4. Verification at Each Step

Every step must have a verifiable outcome:

- A way to confirm the step succeeded (e.g., check a status, see a value, receive a confirmation)
- The strategy code must return verification data after execution

### 5. Credentials and Secrets

- List every credential or secret required (API tokens, account passwords, etc.)
- Explain exactly how to obtain each credential
- Credentials must be stored as GitHub Actions secrets (not hardcoded)
- Use only the minimum required permissions

### 6. Payout Path

Every strategy must document:

- How earnings are collected (which platform holds the funds)
- How to connect a real bank account for payouts
- What the minimum payout threshold is
- How long payouts typically take

## Strategy Template

Every strategy implementation must include a `getExecutionGuide()` method (or equivalent static property) that returns the full step-by-step guide. Example structure:

```javascript
static getExecutionGuide() {
  return {
    name: 'Strategy Name',
    fullCycle: true, // Must be true — partial cycles are not accepted
    steps: [
      {
        id: 1,
        title: 'Step title (simple, action-oriented)',
        description: 'What to do, explained simply',
        type: 'manual' | 'automated',
        url: 'https://...',        // For manual steps: where to go
        action: 'Click "Enable"',  // For manual steps: exact action
        verification: 'You should see ...',
        automationHint: null,      // For manual steps: why not automated
      },
      {
        id: 2,
        title: 'Step title',
        description: 'What the automation does',
        type: 'automated',
        triggerCommand: 'npm run strategy:execute',
        triggerGitHubAction: 'Run workflow: execute-strategy.yml',
        verification: 'Result contains earnings > 0',
        automationHint: 'Runs automatically via GitHub Actions',
      },
    ],
    payoutPath: {
      platform: 'Platform Name',
      minimumPayout: '$10',
      payoutTime: '~30 days',
      bankConnectionUrl: 'https://...',
      instructions: 'Step-by-step bank connection instructions',
    },
  };
}
```

## Compliance

All strategies must also satisfy the existing compliance requirements:

- Legal in the user's jurisdiction
- Compliant with all platform Terms of Service
- No unauthorized access or deceptive practices
- Full audit trail via the Logger

## Review Checklist

Before a strategy is merged, verify:

- [ ] `fullCycle: true` — strategy covers setup → earn → bank account
- [ ] Every step is documented with `type: 'manual'` or `type: 'automated'`
- [ ] Every automated step has a `triggerGitHubAction` or `triggerCommand`
- [ ] Every manual step has the exact URL and action
- [ ] Payout path is fully documented including bank account connection
- [ ] Credentials required are listed with instructions to obtain them
- [ ] `getExecutionGuide()` method is implemented and tested
- [ ] Verification data is returned after strategy execution
