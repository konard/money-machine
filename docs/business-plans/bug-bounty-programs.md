# Bug bounty hunting on authorized programs (HackerOne, Bugcrowd, Intigriti, huntr)

**Rank #206 · Tier C · Priority score 41/100 · Category: Micro-tasks & paid research**

Find and responsibly report security vulnerabilities in in-scope assets of companies that run public bounty programs.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 2/10 |
| Automation after setup | 4/10 |
| Setup effort (1 = trivial) | 6/10 |
| Ongoing effort (1 = none) | 6/10 |
| Income potential | 8/10 |
| AI leverage | 6/10 |
| Legal in reference countries | 95% |
| Platform pays out in reference countries | 90% |
| Capital required | $0 |
| Time to first dollar | 30–365 d |
| Typical monthly income (low / median / high) | $0 / $0 / $5,000 |

## Realistic expectations

Most people who try this earn around **$0–$0 per month** in the first year; the high figure of $5,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **2/10**. Expect the first payment after 30–365 d.

## How it works

Companies publish a scope, rules and reward tables. You test only in-scope assets under the program's safe-harbour terms, write a reproducible report, and get paid when the finding is triaged and accepted. huntr runs AI/ML-focused challenges with prize pools. Recon and scanning can be scripted within rate limits the program allows. Exploitation and reporting need skill, and payouts follow a power law.

**Platforms:** HackerOne, Bugcrowd, Intigriti, huntr

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 200 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | Burp Suite Community (free; Pro about $475/year optional); PortSwigger Web Security Academy (free); open-source recon tools (free); optional $5/month VPS |
| Skills | web/API security testing; writing reproducible reports; reading program scope and rules; AI helps with recon and code review but not validation |
| Equipment | laptop |
| Accounts | HackerOne / Bugcrowd / Intigriti account + KYC and tax form; PayPal or bank |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per accepted report (bounty) |
| Typical price per unit (low / median / high) | $100 / $500 / $10,000 |
| Direct cost per unit | $0 |
| Platform fee | 0% |
| Gross margin (median case) | 100% |
| Human hours per unit after automation | 40 |

Typical low/medium-severity bounties are $100-1,000; critical findings pay $5,000+. Platforms charge companies, not hunters; the 40 hours per accepted report includes duplicates and N/A reports.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 9 |
| Months to recover startup cash | 0 |

No fixed costs, so every paid unit is profit; break-even equals the time to the first payout. Learning plus the first accepted report usually takes 6-12 months, and most starters never get there.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | growing |
| Competition | saturated |
| Effect of AI | neutral |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **4%** |
| Typical net profit at month 12 (low / median / high) | $0 / $0 / $4,000 |

Program count and AI/ML scopes keep growing, but hunters now outnumber easy bugs, and duplicates are the norm on popular programs. Since 2025 programs are flooded with AI-generated junk reports (curl ended its bounty over this), so triage is stricter. Payouts follow a power law: a few hundred full-time hunters take most of the money.

### Pricing strategy

Rewards are set by program tables; target newer or private programs and less-popular asset types where duplicates are rarer, and build reputation to get private invitations with higher bounties.

### Path to profit

1. Month 0: work through PortSwigger Academy labs (about 200 hours, cost $0)
2. Month 1-6: hunt 1-2 programs deeply; expect duplicates and N/A reports, likely $0
3. Month 6-9: first accepted low/medium bugs: $100-500
4. Month 9-12: private invitations if reputation grows; income stays lumpy, $0-4,000/month

_Business-plan sources:_

- <https://docs.hackerone.com/en/articles/8395720-payment-preferences>
- <https://github.com/reddelexc/hackerone-reports/blob/master/tops_100/TOP100PAID.md>

## Payout path

- **Methods:** PayPal, bank transfer (Currencycloud/local), USDC/BTC (HackerOne; Bugcrowd select researchers)
- **Minimum payout:** HackerOne: PayPal none; crypto $15; local bank $50; SWIFT $100. Bugcrowd/Intigriti: not stated in docs
- **Frequency:** per bounty (HackerOne processes weekdays; none on first/last day of month)
- **Typical delay:** 3 days
- **Notes:** HackerOne PayPal arrives in 1-2 days, bank in 1-10 days. Bugcrowd pays by PayPal (up to 24h+) or bank transfer and uses a payment-threshold setting for small rewards. Intigriti funds arrive 1-3 working days in Belgium and 3-5 internationally; the previously reported €50 minimum is not in its knowledge base and is unconfirmed.

## Full cycle (setup → earn → bank account)

1. Learn the basics (PortSwigger Academy)
2. Pick a program
3. Recon in scope
4. Submit a report
5. Bounty -> PayPal/bank

## What can be automated

- Automated recon (subdomain/asset monitoring) on in-scope assets
- LLM-assisted code review and report drafting
- Alerts for new programs and scope changes

## Unavoidable manual steps

- Manual validation and exploitation
- Writing reports and talking to triage
- Following disclosure rules

## Legality & compliance

Legal only within authorized scope and safe harbour. Testing outside scope is a computer-crime offence. Payouts are blocked for OFAC-sanctioned banks and persons.

- **Compliance requirements:** stay strictly in scope; follow program rules on automation/rate limits; report income for tax; KYC/tax forms
- **Platform availability:** Open globally apart from sanctioned countries. HackerOne cannot pay HDFC Bank India accounts.

## Risks

- Many hunters never earn
- Duplicates and N/A reports
- Legal risk if out of scope

## Evidence that people get paid

HackerOne's official docs list payout methods, minimums and schedules. Bugcrowd's payments FAQ and Intigriti's payout-lifecycle article document their methods and timing. Top-paid HackerOne reports are publicly catalogued.

## Sources

- <https://docs.hackerone.com/en/articles/8395720-payment-preferences>
- <https://docs.bugcrowd.com/researchers/payments/frequently-asked-questions-payment-methods/>
- <https://kb.intigriti.com/en/articles/3379564-payout-lifecycle>
- <https://github.com/reddelexc/hackerone-reports/blob/master/tops_100/TOP100PAID.md>
- <https://huntr.com/>

_Tags: security, skill-based, power-law_

---

_Generated from `data/strategies/micro-tasks.json` by `npm run build:catalog`. Edit the JSON, not this file._
