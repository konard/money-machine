# Platform Rules and Terms of Service Database

This document serves as a reference for major platform rules that the money-machine must respect. All automation must comply with these rules to ensure legal and sustainable operation.

## General Principles

1. **Authenticity**: Never impersonate humans when acting as a bot
2. **Rate Limiting**: Respect all rate limits and fair use policies
3. **Spam Prevention**: Never send unsolicited bulk messages
4. **Value Creation**: Focus on providing genuine value
5. **Transparency**: Disclose bot/automation status when required
6. **Data Privacy**: Respect user privacy and data protection laws

## Major Platforms

### GitHub
**URL**: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service

**Key Rules**:
- Bots must identify themselves in user agent strings
- Must not abuse API rate limits (5000 requests/hour for authenticated)
- Must not create accounts via automated means without permission
- Must not use platform for spam or commercial content unrelated to development
- Bug bounty hunting allowed only on authorized programs

**Rate Limits**:
- REST API: 5,000 requests/hour (authenticated)
- GraphQL API: 5,000 points/hour
- Search API: 30 requests/minute

**Best Practices for Bots**:
- Use `User-Agent: money-machine-bot (github.com/username/money-machine)`
- Implement exponential backoff for rate limit errors
- Cache responses when possible

### Fiverr
**URL**: https://www.fiverr.com/terms_of_service

**Key Rules**:
- One account per person
- Must deliver services as described
- No automation of communication (must respond personally)
- No external links in initial contact
- Must deliver work within deadline
- Gig fulfillment can be automated if quality maintained

**Automation Considerations**:
- Can automate: service delivery, file processing, analysis
- Cannot automate: customer communication, account creation
- Must monitor for disputes and respond personally

### Upwork
**URL**: https://www.upwork.com/legal

**Key Rules**:
- Freelancers must be real individuals
- Must personally perform work or clearly indicate subcontracting
- All communication must be genuine
- No automated bidding
- Can use tools to perform work

**Automation Considerations**:
- Can automate: actual work delivery, reporting
- Cannot automate: proposals, client communication
- Hybrid approach: human oversight + automated execution

### YouTube
**URL**: https://www.youtube.com/t/terms

**Key Rules**:
- Must own rights to all content
- No misleading metadata
- Must follow Community Guidelines
- Automated channels allowed if quality maintained
- Must disclose paid promotions

**Content Requirements**:
- No spam, scams, or deceptive practices
- Must add value (not just automated compilations)
- Follow copyright law strictly
- Monetization requires: 1000 subscribers + 4000 watch hours

**Automation Best Practices**:
- Use royalty-free content or create original
- Quality over quantity
- Clear attribution for sources
- Genuine commentary/transformation

### Medium
**URL**: https://policy.medium.com/medium-terms-of-service-9db0094a1e0f

**Key Rules**:
- No spam or manipulation
- Must be original or properly attributed content
- No automated posting for spam
- Partner Program requires human-written content
- Can use AI but must disclose

**Automation Considerations**:
- AI-generated content allowed with disclosure
- Must provide unique value
- No bulk automated posting
- Quality standards for monetization

### Twitter/X
**URL**: https://twitter.com/en/tos

**Key Rules**:
- Must identify bots
- No aggressive automation
- Rate limits strictly enforced
- No spam, manipulation, or fake engagement
- API usage must follow developer terms

**Rate Limits (Free Tier)**:
- Very limited for free accounts
- Paid API required for meaningful automation

**Automation Best Practices**:
- Use official API only
- Clearly mark bot accounts
- Don't auto-follow, auto-DM, or spam
- Provide genuine value in automated posts

### Reddit
**URL**: https://www.redditinc.com/policies/user-agreement

**Key Rules**:
- Bots must be approved by subreddit moderators
- Must follow reddiquette
- No spam or manipulation
- Clearly identify as bot
- Must respect subreddit-specific rules

**API Rules**:
- Must include descriptive user agent
- Rate limit: 60 requests per minute
- Must handle errors gracefully
- Cache aggressively

### Amazon Associates (Affiliate)
**URL**: https://affiliate-program.amazon.com/help/operating/agreement

**Key Rules**:
- Must clearly disclose affiliate relationship
- No misleading practices
- Links must be in appropriate context
- Cannot incentivize clicks
- Must maintain website/app with content

**Compliance Requirements**:
- Disclosure statement on every page with links
- Links must be contextually relevant
- No automated bulk posting
- Quality content required

### PayPal
**URL**: https://www.paypal.com/us/legalhub/useragreement-full

**Key Rules**:
- Acceptable Use Policy strictly enforced
- No selling of services violating laws
- Must maintain accurate business information
- Chargebacks can freeze accounts

**Best Practices**:
- Deliver services promptly
- Maintain clear documentation
- Respond to disputes quickly
- Build transaction history gradually

### Stripe
**URL**: https://stripe.com/legal/ssa

**Key Rules**:
- Must follow Acceptable Use Policy
- Clear service descriptions required
- No prohibited businesses
- Must handle refunds appropriately

**Risk Management**:
- Start with smaller transactions
- Build history gradually
- Maintain detailed records
- Quick customer support

## Email Service Providers

### Gmail
**Key Rules**:
- Follow CAN-SPAM Act
- No mass automated sending without consent
- Can use for automated transactional emails
- Bulk sending requires proper infrastructure

### SendGrid/Mailgun (Free Tiers)
**Key Rules**:
- Must verify domain
- Follow anti-spam policies
- Maintain low bounce rates
- Honor unsubscribe requests immediately

## Legal Frameworks

### CAN-SPAM Act (US)
**Requirements**:
- Accurate "From" information
- Clear subject lines
- Identify message as ad
- Include physical address
- Honor opt-out requests within 10 days
- Monitor what others do on your behalf

### GDPR (EU)
**Requirements**:
- Lawful basis for processing data
- Right to access, correct, delete data
- Data minimization
- Security measures
- Privacy by design

### General Compliance
- No services requiring licenses (financial advice, legal services)
- Tax obligations apply (report income)
- Consumer protection laws apply
- Intellectual property laws must be respected

## Rate Limiting Strategy

To respect all platforms, implement:

1. **Global Rate Limiter**: Track requests across all platforms
2. **Per-Platform Limits**: Respect individual platform limits
3. **Exponential Backoff**: Handle rate limit errors gracefully
4. **Request Queuing**: Batch requests efficiently
5. **Cache Everything**: Minimize redundant requests

## Recommended Implementation

```javascript
// Platform-specific configuration
const PLATFORM_LIMITS = {
  github: { requestsPerHour: 5000, burstLimit: 100 },
  reddit: { requestsPerMinute: 60 },
  twitter: { requestsPerDay: 500 }, // free tier
  // ... etc
};

// Before any platform action:
// 1. Check if action complies with platform rules
// 2. Verify rate limit availability
// 3. Log action for audit trail
// 4. Execute with error handling
// 5. Update rate limit counter
```

## Monitoring and Compliance

The money-machine should:
1. Log all platform interactions
2. Track rate limit usage
3. Monitor for ToS violations
4. Automatically pause if limits approached
5. Generate compliance reports

## Updates Required

This document should be reviewed and updated:
- Monthly: Check for ToS updates
- When adding new platforms
- After any platform changes
- When legal frameworks change

## Resources

- ToS;DR (Terms of Service; Didn't Read): https://tosdr.org/
- Platform API documentation (always authoritative)
- Legal consultation for specific jurisdictions
