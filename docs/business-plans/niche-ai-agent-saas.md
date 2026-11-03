# Niche 'AI employee' chatbot/voice agent sold per seat to a vertical

**Rank #65 · Tier B · Priority score 57/100 · Category: AI-native income**

Build a no-code AI agent (Voiceflow/Botpress) for one vertical (e.g. dental clinics, property managers) and sell it as a monthly subscription.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 4/10 |
| Automation after setup | 7/10 |
| Setup effort (1 = trivial) | 6/10 |
| Ongoing effort (1 = none) | 5/10 |
| Income potential | 8/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 95% |
| Capital required | $50 |
| Time to first dollar | 21–120 d |
| Typical monthly income (low / median / high) | $0 / $600 / $10,000 |

## Realistic expectations

Most people who try this earn around **$0–$600 per month** in the first year; the high figure of $10,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **4/10**. Expect the first payment after 21–120 d.

## How it works

You pick a vertical with repetitive inbound questions or bookings, build an agent connected to their calendar/CRM/FAQ, and resell it as a done-for-you monthly service. Clients pay a setup fee plus per-seat or per-location monthly. Botpress has a formal partner program for agencies; Voiceflow targets agencies. Once one template works, cloning it for new clients is largely automated; sales remains human.

**Platforms:** Botpress, Voiceflow, Stripe Billing

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 60 hours |
| One-time cash | $50 |
| Recurring fixed cost | $50 / month |
| Tools | Botpress (free tier to start; Plus $150/mo billed annually once clients pay for it) or Voiceflow (usage-based); voice API (per-minute usage); Stripe Billing; domain + landing page ($50) |
| Skills | agent design and integrations (calendar/CRM); B2B sales to local businesses; monitoring for hallucinations and escalation |
| Equipment | laptop; smartphone for testing calls |
| Accounts | Botpress/Voiceflow account; Stripe or Wise business account; Telephony provider account if voice |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per client-month |
| Typical price per unit (low / median / high) | $99 / $249 / $500 |
| Direct cost per unit | $30 |
| Platform fee | 3% |
| Gross margin (median case) | 85% |
| Human hours per unit after automation | 2 |

Agencies commonly charge $99-$500/month per location plus setup; cost = LLM/voice usage per client (estimate); fee = card processing.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $50 |
| Units per month to break even | 1 |
| Typical months to break even | 4 |
| Months to recover startup cash | 1 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). One client covers platform fees; setup fees often cover the startup cash. Fixed cost assumes the free/usage-based builder tier plus voice/LLM floor; upgrading to Botpress Plus adds ~$150/mo (estimated as a pass-through to clients).

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | growing |
| Competition | saturated |
| Effect of AI | tailwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **20%** |
| Typical net profit at month 12 (low / median / high) | $-50 / $80 / $7,000 |

The 'AI automation agency' wave of 2024-2026 made this crowded; winners specialise in one vertical (dental, HVAC, real estate) and own a referral channel. Vertical SaaS vendors increasingly bundle native AI receptionists, pressuring prices. Failure mode: no sales skills, or churn after a hallucination incident. Median net at month 12 set to $80 to match the 20% profit likelihood.

### Pricing strategy

Charge a setup fee ($300-$1,000) plus a monthly fee with a 30-day pilot; raise prices after documenting booked appointments or saved staff hours.

### Path to profit

1. Month 0: build a vertical demo agent (cost $50 + $50/mo)
2. Month 1-2: 100+ outreach contacts, 1 pilot; $0-$300
3. Month 3-6: 2-3 paying clients; $250-$750/month
4. Month 6-12: templated onboarding, 4-10 clients; $300 median, $2,000+ top quartile

_Business-plan sources:_

- <https://botpress.com/pricing>
- <https://botpress.com/partners>
- <https://www.voiceflow.com/pricing>

## Payout path

- **Methods:** Stripe -> bank, Wise, Payoneer
- **Minimum payout:** none (direct billing)
- **Frequency:** monthly recurring
- **Typical delay:** 7 days
- **Notes:** Common pricing $99-$500/month per client plus setup.

## Full cycle (setup → earn → bank account)

1. Choose vertical
2. Build template agent
3. Sign first client
4. Deploy and integrate
5. Monthly billing
6. Payout to bank

## What can be automated

- Template agent cloned per client via API
- Agent ingests client docs into knowledge base
- Automated conversation QA and reports
- Billing automation via Stripe

## Unavoidable manual steps

- Sales calls and onboarding
- Contract and DPA signing
- Payment KYC

## Legality & compliance

Legal; respect call-recording/consent and AI-disclosure rules (e.g. EU AI Act transparency, US state bot-disclosure laws, TCPA for outbound calls).

- **Compliance requirements:** report income for tax; AI disclosure to end users; privacy/DPA with clients; no outbound robocalls without consent
- **Platform availability:** Tooling available globally; billing via Stripe or Wise/Payoneer invoices.

## Risks

- Platform price changes squeeze margin
- Hallucination liability
- Churn when vertical SaaS adds native AI

## Evidence that people get paid

Botpress runs an official partner program for agencies selling AI agents as a service; many agencies publicly sell AI receptionists per month.

## Sources

- <https://botpress.com/partners>
- <https://www.voiceflow.com/blog/white-label-chatbot>

_Tags: saas, b2b, recurring, no-code_

---

_Generated from `data/strategies/ai-native.json` by `npm run build:catalog`. Edit the JSON, not this file._
