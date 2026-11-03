# Platform Rules and Terms of Service Database

This document is the reference for the platform rules that the money-machine must respect. All automation must follow these rules so that operation stays legal and sustainable.

**Scope.** It covers every platform that appears in two or more strategies of the catalog (`data/strategies.json`), plus every platform used by a tier-S or tier-A strategy. Platforms are grouped by catalog category, in the catalog's order. Payout, legality and availability facts come from the catalog fields `payout.*`, `legality.*`, `availability.*` and `sources`. Where an official page was checked (November 2026), the entry says "(verified)". Anything else is a catalog figure or a widely published policy, and it must be re-checked against the linked policy before money depends on it.

**Field legend.**

- **Policy**: the official ToS or policy page.
- **Automate**: what may be automated.
- **Human**: what a human must do.
- **AI**: rules on AI-generated content and how to disclose it.
- **Accounts**: identity and multi-account rules.
- **Payout**: minimum, method and countries.
- **API**: official API and its rate limits.

## General Principles

1. **Authenticity**: Never impersonate humans when acting as a bot
2. **Rate Limiting**: Respect all rate limits and fair use policies
3. **Spam Prevention**: Never send unsolicited bulk messages
4. **Value Creation**: Focus on providing genuine value
5. **Transparency**: Disclose bot/automation status when required
6. **Data Privacy**: Respect user privacy and data protection laws

## Cross-Platform Rules

These rules repeat across almost every platform below, so they are stated once here.

- **KYC is always human.** Every platform that pays out needs identity verification, a tax form (W-8BEN/W-9 or a local equivalent) and payout-account linking. A real person does these steps once. The bot must never automate account creation.
- **One real identity per account.** Self-referrals, duplicate accounts and accounts made to evade a ban break the terms of every cashback, referral, bonus, freelancing and contributor program in this file.
- **AI disclosure is now a platform rule, not just good practice.** Disclosure is required by Adobe Stock, Freepik, KDP, Etsy, YouTube (realistic synthetic media), Meta, TikTok, Spotify/DDEX credits, Fiverr and end-user chatbots (EU AI Act transparency). Shutterstock, Pond5 and ACX refuse unauthorized AI content outright.
- **Scaled thin content is penalized.** Google spam policies (scaled content abuse), AdSense, YouTube "inauthentic content" and Pinterest spam rules all target mass-produced, low-value output. Gate every published item behind a human or rubric QA step.
- **Advertising disclosure.** Affiliate links and sponsored content need FTC (US), CAP/ASA (UK) or equivalent labels on every post.
- **Generic channels are not separate platforms.** The catalog also lists direct clients, own sites, email newsletters, direct sponsors and self-hosted directory software. Their rules come from the payment rail (Stripe, Wise, PayPal) and the Legal Frameworks section.
- **Payout rails decide country coverage.** The common limits are Stripe (about 46 countries), Stripe Connect, PayPal receiving (unavailable in Bangladesh, Sri Lanka, Lebanon, Libya, Iraq and a few others) and Payoneer/Wise (broadest coverage).

### AI Content Quick Reference

| Platform                  | AI-generated content                                                        | Disclosure mechanism                         |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| Adobe Stock               | Allowed                                                                     | "Created using generative AI tools" checkbox |
| Freepik                   | Allowed                                                                     | AI flag at upload                            |
| Shutterstock              | Not accepted from contributors (verified)                                   | n/a                                          |
| Pond5                     | Restricted; catalog says AI uploads lead to account termination             | n/a                                          |
| Amazon KDP                | Allowed; AI-generated must be disclosed, AI-assisted need not be (verified) | Question at title setup                      |
| ACX (Audible)             | Unauthorized TTS/AI narration prohibited (verified)                         | n/a                                          |
| Google Play Books         | Auto-narration offered by Google                                            | Labelled by Google                           |
| Etsy                      | Allowed under "Designed by" with disclosure                                 | Listing description / Creativity Standards   |
| YouTube                   | Allowed; realistic synthetic media must be disclosed (verified)             | "AI use" attribute in YouTube Studio         |
| Meta (Facebook/Instagram) | Allowed; photorealistic AI must be labelled                                 | "AI info" label                              |
| TikTok                    | Allowed; must be labelled                                                   | AIGC label                                   |
| Spotify / DSPs            | Allowed; spam, impersonation and voice clones of real artists banned        | DDEX AI credits via distributor              |
| Envato (AudioJungle)      | AI-primary music banned (catalog)                                           | n/a                                          |
| Fiverr                    | Allowed under Fiverr AI standards; no voice cloning without consent         | Disclose to buyer                            |
| Chatbots for clients      | Allowed                                                                     | Tell end users they are talking to an AI     |

## Finance & Capital-Light Arbitrage

Shared rules: KYC and bank linking are human steps. Automation is limited to monitoring rates and offers, sweeping balances and reminding about deadlines. The bot must never open accounts or move money without a human approval rule. Rewards and interest are taxable in most countries.

### Savings, Money-Market Funds and Government Bills

Used by `high-yield-savings-mmf-tbills` (S).

| Platform                                               | Policy                                                               | Notes                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Online banks (Marcus, Ally, Chase UK, Trade Republic)  | Each bank's account terms                                            | One customer per identity; stay under deposit-insurance limits per bank                        |
| TreasuryDirect                                         | https://www.treasurydirect.gov/marketable-securities/treasury-bills/ | US persons only; auto-reinvest is built in, so no scripting is needed                          |
| Tesouro Direto                                         | https://www.tesourodireto.com.br/                                    | Brazilian CPF required                                                                         |
| Vanguard / Fidelity MMFs                               | Fund prospectus and brokerage terms                                  | Sweep rules set in the account; no public trading API for retail                               |
| Local T-bill auctions (e.g. Nigeria, Kenya, Singapore) | Central bank / MAS auction rules                                     | Local residency and a custodian or bank account; high local yields carry FX and inflation risk |

- **Payout**: interest is credited monthly; bills pay at maturity (4-52 weeks). No minimum.
- **Legality**: legal everywhere. Islamic equivalents are profit-sharing deposits and sukuk.

### Robo-Advisors

Used by `robo-advisor-index-dividends` (S). The catalog marks foreign platforms as restricted in Bangladesh, Nepal, Tunisia, Morocco, Libya and Iraq (capital controls). Use local index funds there.

| Platform         | Policy                            | Coverage (catalog)                |
| ---------------- | --------------------------------- | --------------------------------- |
| Betterment       | https://www.betterment.com/legal  | US                                |
| Wealthfront      | https://www.wealthfront.com/legal | US                                |
| Nutmeg           | https://www.nutmeg.com/legal      | UK                                |
| Scalable Capital | https://scalable.capital/en/legal | EU                                |
| StashAway        | https://www.stashaway.sg/         | SG, MY and others                 |
| Syfe             | https://www.syfe.com/             | SG, AU                            |
| Wahed            | https://www.wahed.com/            | Several Muslim-majority countries |

- **Human**: KYC and the suitability questionnaire must be answered truthfully by the account holder.
- **Payout**: dividends are paid quarterly. Withdrawals take 2-5 days, and some platforms set a $1-$100 minimum withdrawal.

### Bank Account Sign-Up Bonuses

Used by `bank-account-signup-bonuses` (A). This covers Chase, Wells Fargo and SoFi (US), UK CASS switching offers, Canada's big-5 banks and German direct banks. Offers are tracked through Doctor of Credit (https://www.doctorofcredit.com/best-bank-account-bonuses/) and MoneySavingExpert, which are information sources, not counterparties.

- **Accounts**: one bonus per person per offer. Many banks limit eligibility to once every 12-24 months and claw back the bonus if the account closes within about 6 months.
- **Human**: account opening, payroll or direct-deposit changes, and closing accounts after the hold period.
- **Automate**: offer tracking, calendar reminders for deposit and hold deadlines.
- **Payout**: a fixed $100-$900 is credited to the new account 30-120 days after the requirements are met. Offers exist mainly in the US, UK, Canada, Germany and Australia. A local residence and address are required.

### Brokerage Sign-Up and Transfer Bonuses

Used by `brokerage-signup-transfer-bonuses` (A) and `fintech-referral-bonuses` (A, IBKR).

| Platform            | Policy                                                        | Notes (catalog)                                    |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Robinhood           | https://robinhood.com/ (legal disclosures)                    | US; free-share promos                              |
| Webull              | https://www.webull.com/policy                                 | US and Asia; transfer matches have holding periods |
| moomoo              | https://www.moomoo.com/                                       | US, SG, AU, MY, JP, CA                             |
| Tiger Brokers       | https://www.tigerbrokers.com.sg/                              | SG, AU, NZ, HK                                     |
| Trading 212         | https://www.trading212.com/                                   | UK, EU                                             |
| Public.com          | https://public.com/disclosures                                | US                                                 |
| Interactive Brokers | https://www.interactivebrokers.co.uk/en/accounts/referrer.php | Referral program excludes Japan, Spain and Israel  |

- **Accounts**: one per person. Free shares are often locked for 2-30 days. Transfer matches may require holding for 1-5 years or are clawed back.
- **API**: IBKR offers a trading API, but bonuses do not require trading automation. Do not run wash trades to meet requirements.
- **Payout**: sell the shares and withdraw to a bank. Free shares are taxable at receipt. Non-US residents file a W-8BEN.

### Cashback Portals

Used by `cashback-portals` (S).

| Platform    | Policy                          | Minimum payout (catalog)    | Region          |
| ----------- | ------------------------------- | --------------------------- | --------------- |
| Rakuten     | https://www.rakuten.com/help    | US $5.01, paid quarterly    | US, CA, JP, FR  |
| TopCashback | https://www.topcashback.com/    | ~$0.01 confirmed, on demand | US, UK          |
| Quidco      | https://www.quidco.com/         | Not in catalog              | UK              |
| iGraal      | https://www.igraal.com/         | Not in catalog              | FR, DE          |
| ShopBack    | https://www.shopback.com/       | ~S$10                       | SEA, AU, KR, TW |
| Cashrewards | https://www.cashrewards.com.au/ | Not in catalog              | AU              |

- **Accounts**: one account per person (often per household). No self-referrals or fake referrals.
- **Automate**: price and rate comparison, and pending-cashback tracking. Do not script purchases or browser extensions that click affiliate links without a real purchase intent, because portals treat that as cookie stuffing.
- **Payout**: PayPal, ACH/bank, check or gift cards. Cashback stays pending for 30-90 days until the merchant confirms it.

## Other

### Salad (idle PC compute)

Used by `salad-idle-pc-compute` (S).

- **Policy**: https://salad.com/terms. Rewards help: https://support.salad.com/rewards/redeeming-your-rewards/how-to-redeem-paypal
- **Automate**: the desktop client runs unattended. Run it only on hardware you own and pay the electricity for.
- **Accounts**: one account per person. Do not farm with VMs or rented machines.
- **Payout**: PayPal rewards in supported countries arrive within about 24 hours, at small storefront denominations. Elsewhere only gift cards are available, which fails the bank-path rule.

### Vast.ai (GPU rental)

Used by `rent-gpu-vast-ai` (S).

- **Policy**: https://vast.ai/terms. Host payments: https://docs.vast.ai/host/payment
- **Automate**: pricing and availability, machine health monitoring.
- **Human**: hardware setup and repairs, payout-provider KYC. Check that your ISP and electricity terms allow hosting.
- **Payout (verified)**: Wise, PayPal or Stripe; no direct bank, ACH or wire. The minimum is $20. Invoices are generated on Fridays and paid the following Friday. The first payout can take up to two weeks.

### Storj (and Sia)

Used by `rent-storage-storj-node` (S).

- **Policy**: https://www.storj.io/legal (node operator terms)
- **Automate**: the node runs unattended. Monitor uptime, because downtime disqualifies the node.
- **Accounts**: one identity per node. Running many nodes behind one IP subnet does not increase traffic and may break the terms.
- **Payout**: STORJ tokens, paid monthly. The L1 threshold depends on gas fees; payouts through zkSync have a lower threshold. A regulated exchange is needed to reach a bank. Receiving crypto is banned or restricted in Bangladesh, Nepal, Morocco, Iraq, Libya, Tunisia and Angola, and restricted in Ecuador, Jordan and Lebanon.

### Afternic (GoDaddy) and Dan.com

Used by `domain-lease-to-own` (A) and `domain-flipping-parking` (B, which also covers GoDaddy Auctions).

- **Policy**: https://www.afternic.com/. Dan.com is being shut down and its sellers migrated to Afternic: https://news.dan.com/240812-seller-migration-faqs
- **Automate**: portfolio listing, pricing and renewal decisions with a rules engine, and trademark screening before purchase.
- **Human**: purchase budget, negotiation, KYC.
- **Rules**: avoid names that contain trademarks, which is cybersquatting under UDRP/ACPA.
- **Payout**: monthly installments for lease-to-own, by bank transfer or PayPal. Afternic thresholds and commissions apply.

## Data & Security Work

### Honeygain and Pawns.app (bandwidth sharing)

Used by `bandwidth-sharing` (S).

- **Policy**: https://www.honeygain.com/terms-of-use/ and https://pawns.app/ (terms of service)
- **Automate**: the app runs unattended on devices you own.
- **Human**: check your ISP terms, many of which forbid reselling bandwidth. Do not run the app on employer, shared or metered networks, or through a VPN or proxy.
- **Accounts**: one account per person. Running it on multiple devices you own is permitted.
- **Payout (Honeygain, verified)**: the minimum is $20 (20,000 credits), paid to PayPal in USD or to JumpTask for gift cards or crypto. Credits expire after 6 months without sharing.

### Apify Store (Actors and MCP tools)

Used by `public-data-scraping-service` (A) and `apify-actors-mcp-tools` (A). The same rules apply to the Apify MCP server and other MCP marketplaces such as MCPize.

- **Policy**: https://docs.apify.com/legal. Monetization: https://docs.apify.com/platform/actors/publishing/monetize
- **Automate**: Actor builds, runs, monitoring and pricing are all API-driven. The payout invoice is auto-approved.
- **Human**: legal review of each target site (ToS, robots.txt, database rights), KYC, and support replies.
- **Rules**: no personal data, no login or paywall bypass, and GDPR compliance when personal data is touched. The rental pricing model is being phased out in 2026 in favour of pay-per-event or pay-per-result. The catalog reports a 20% Apify commission.
- **Payout (verified)**: PayPal and Wise have a $20 minimum; other methods have a $100 minimum. Invoices are generated on the 11th and auto-approved on the 14th, and payouts arrive between the 21st and 25th. Balances below the minimum roll over.
- **API**: the Apify API applies per-resource rate limits. Respect the limits of the target sites as well.

### AWS Data Exchange

Used by `licensed-data-api-feeds` (A) and `sell-datasets` (B).

- **Policy**: https://aws.amazon.com/data-exchange/ (AWS Marketplace seller terms apply).
- **Rules**: data must be non-personal and licensed for commercial redistribution. Providers must be companies in AWS-eligible jurisdictions.
- **Automate**: dataset revisions are published through the API.
- **Payout**: AWS Marketplace disbursement to a bank, monthly.

## AI-Native Income

### ElevenLabs (Voice Library and Dubbing)

Used by `elevenlabs-voice-library` (S), `ai-voiceover-podcast-editing` (A) and `ai-dubbing-localization-service` (A).

- **Policy**: https://elevenlabs.io/terms-of-use and https://elevenlabs.io/use-policy
- **Automate**: TTS and dubbing generation through the API, and QA pipelines.
- **Human**: recording the voice sample, Voice Captcha verification and Stripe Connect KYC. Native-speaker spot checks of dubbing.
- **AI**: you may only clone your OWN voice. For dubbing, get written consent from the voice owner, and only localize content the client owns.
- **Accounts**: identity verification ties each Professional Voice Clone (PVC) to its owner. Creating a PVC requires the Creator plan or higher.
- **Payout (verified)**: through Stripe Connect. The minimum is $10 in most countries and higher in some. Payouts run automatically every 6-8 days once the minimum is reached. Only usage by paid users earns money. Countries without Stripe Connect cannot receive payouts.
- **API**: concurrency limits depend on the plan.

### Troveo and Calliope Networks (AI training footage)

Used by `ai-training-footage-licensing` (A).

- **Policy**: per-broker licensing contracts (https://www.troveo.ai/).
- **Human**: rights review, contract signing and broker KYC.
- **Rules**: you must own the copyright and hold model and property releases. The footage must not contain other people's likenesses or copyrighted music.
- **Payout**: per deal, by bank transfer or PayPal depending on the broker.

### Botpress and Voiceflow (agent SaaS)

Used by `niche-ai-agent-saas` (A). The same rules apply to `local-business-chatbot-setup` (A).

- **Policy**: https://botpress.com/partners and https://www.voiceflow.com/legal
- **AI**: bots must tell end users they are AI. This is required by EU AI Act transparency rules and US state bot-disclosure laws. Outbound robocalls without TCPA consent are not allowed. Do not give medical or legal advice.
- **Human**: sales calls, contracts and DPAs (data processing agreements), and onboarding.
- **Payout**: direct billing through Stripe Billing or Wise/Payoneer invoices.

### Vercel and Cloudflare (hosting)

Used by `ai-micro-tools-site` (A).

- **Policy**: https://vercel.com/docs/limits/fair-use-guidelines and https://www.cloudflare.com/terms/
- **Rule (verified)**: Vercel Hobby is "restricted to non-commercial personal use only". Commercial use covers any payment processing, affiliate-first sites and any ads, including AdSense. A monetized tool site needs Vercel Pro, or Cloudflare Pages/Workers instead.
- **Limits**: the Vercel Hobby fair-use guide is about 100 GB transfer and 1M function invocations per month.

### Poe (creator monetization)

Used by `poe-bot-creator` (B) and `ai-assistant-store-revenue` (B).

- **Policy**: https://poe.com/pages/earnings-tos. Docs: https://creator.poe.com/docs/creator-monetization
- **Rules**: bots must follow Poe's rules and the usage policies of the underlying model.
- **Payout**: Stripe to a bank in USD, monthly, about a $10 minimum (catalog, unverified). Only countries on Poe's list can earn. The OpenAI GPT Store revenue share is an invite-only US pilot.

## Marketplaces & E-Commerce

### Used-Goods Marketplaces

Used by `used-goods-reselling` (S). eBay is also used by `amazon-ebay-online-arbitrage` (B).

| Platform             | Policy                                                                              | Region       | API                                                    |
| -------------------- | ----------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| eBay                 | https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259 | ~190 markets | Official Sell APIs with daily call quotas per app      |
| Vinted               | https://www.vinted.com/terms_and_conditions                                         | EU, UK, US   | No public API; ToS forbid bots and scraping            |
| Mercari              | https://www.mercari.com/us/help_center/                                             | US, JP       | No public seller API                                   |
| Poshmark             | https://poshmark.com/terms                                                          | US, CA       | No public API; automated sharing tools risk suspension |
| Depop                | https://www.depop.com/legal/terms-of-service/                                       | UK, US, AU   | Partner API only                                       |
| Facebook Marketplace | https://www.facebook.com/policies_center/commerce                                   | Global       | No listing API for individuals                         |
| OLX                  | Local OLX site terms                                                                | LatAm, Asia  | Partner APIs in some markets                           |
| Jiji                 | https://jiji.ng/ (local terms)                                                      | Africa       | None                                                   |
| Carousell            | https://www.carousell.com/                                                          | SEA          | None                                                   |

- **Automate**: drafting listings (description and price research) and cross-listing through official APIs only.
- **Human**: photographing, packing and shipping items, meeting buyers locally, and anything that is clicked through a marketplace's own app.
- **Rules**: describe item condition honestly, and sell no counterfeit or prohibited items. Regular resale is a business: DAC7 (EU) and 1099-K (US) reporting applies above the thresholds.
- **Accounts**: eBay allows multiple accounts but forbids using them to evade restrictions. The others expect one account per person.
- **Payout**: none to $1 minimum, on demand or daily. Funds are released after the buyer confirms receipt (eBay 1-2 business days; Vinted about 2 days after delivery).

### Redbubble, TeePublic and Amazon Merch on Demand

Used by `pod-marketplaces-redbubble-teepublic-merch` (A).

- **Policy**: https://www.redbubble.com/agreement, https://www.teepublic.com/terms and https://merch.amazon.com/ (Merch content policy)
- **Automate**: design generation drafts and upload metadata. Use bulk upload only where the platform UI offers it, and do not drive the UI with headless bots.
- **Human**: an IP and trademark check of every design, the Merch on Demand application (approval is selective), and the tax interview.
- **Accounts**: one account per person. Merch on Demand caps uploads by tier.
- **Payout**: Redbubble pays by PayPal or bank transfer. Its threshold is $20; the catalog reports $10 from July 2026, but official help pages still say $20. TeePublic pays $20 through Payoneer, with a low or no PayPal minimum. Amazon Merch pays by monthly bank deposit about 30 days after month end. Payout is global through PayPal and Payoneer.

### Shopify

Used by `shopify-dropshipping` (B), `print-on-demand-own-shop` (B), `shopify-apps` (B) and `website-themes-templates` (B).

- **Policy**: https://www.shopify.com/legal/terms and https://www.shopify.com/legal/aup
- **Automate**: catalog, inventory and order sync through the Admin API.
- **Human**: store and payment KYC, ad budget decisions, disputes and chargebacks.
- **Rules**: consumer law applies, including honest delivery times, the EU 14-day withdrawal right, GPSR product safety and no counterfeits. Ad platform policies also apply.
- **Payout**: Shopify Payments pays to a bank every 1-3 business days in about 23 countries. Elsewhere use PayPal or Stripe. Partner and app revenue goes through Hyperwallet with a $25 minimum, twice monthly.
- **API**: the GraphQL Admin API uses cost-based throttling (about 100 points/s on standard plans). The REST API uses a leaky bucket (40 requests, 2/s on standard plans).

### Printful

Used by `shopify-dropshipping` (B) and `print-on-demand-own-shop` (B).

- **Policy**: https://www.printful.com/policies/terms-of-service
- **Automate**: order routing is fully automated through Etsy or Shopify integrations.
- **Human**: ordering samples to check quality, and handling defects and returns.
- **Payout**: none from Printful. You pay the base cost up front and profit arrives through the sales channel.
- **API**: Printful REST API with a general limit of 120 requests per minute.

### Flippa and Escrow.com

Used by `micro-saas-app-flipping` (B) and `website-newsletter-flipping` (C).

- **Policy**: https://flippa.com/terms-of-service and https://www.escrow.com/legal
- **Human**: buyer due diligence, the asset purchase agreement, and account handover.
- **Rules**: misrepresenting traffic or revenue is fraud. Analytics must be verified.
- **Payout**: escrow pays by bank wire per sale. Flippa charges a 5-10% success fee.

## Licensing, Royalties & Rentals

### Stock Media Agencies

Used by `wirestock-multi-agency-distribution` (S), `stock-media-contributor` (A), `ai-stock-imagery-adobe-freepik` (A), `music-sync-stock-libraries` (B) and `stock-music-sound-effects` (C).

| Platform     | Policy                                                                                                                           | AI content                                | Minimum payout (catalog) |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------ |
| Adobe Stock  | https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html | Allowed, with label                       | $25, PayPal or Skrill    |
| Shutterstock | https://submit.shutterstock.com/help/en/articles/10594676-ai-generated-content-on-shutterstock-contributor-faq                   | Not accepted (verified)                   | ~$35                     |
| Pond5        | https://www.pond5.com/legal/contributor                                                                                          | Restricted; catalog says termination risk | $25, paid on the 15th    |
| Freepik      | https://www.freepik.com/ai/faq/faqs-for-contributors                                                                             | Allowed, with label                       | $25 / EUR 50, Payoneer   |
| Dreamstime   | https://www.dreamstime.com/terms                                                                                                 | Per agency rules                          | Via Wirestock            |
| 123RF        | https://www.123rf.com/terms.php                                                                                                  | Per agency rules                          | Via Wirestock            |
| Wirestock    | https://wirestock.io/                                                                                                            | Labels AI and routes it per agency        | $30 (third-party figure) |
| Envato       | https://help.author.envato.com/hc/en-us/articles/360000472943                                                                    | AI-primary music banned on AudioJungle    | $50 (SWIFT higher)       |

- **Automate**: keywording, metadata and batch upload through supported uploaders or FTP.
- **Human**: shooting and curating, model and property releases, and an IP check of every asset.
- **AI**: tick the AI flag on every generated asset. Do not use real people, trademarks, copyrighted characters or artist names in prompts. The generator's terms must grant commercial rights. Do not route AI assets to agencies that refuse them, including Shutterstock through Wirestock.
- **Accounts**: one contributor account per person, with an ID check.

### Music Distribution and YouTube Content ID

Used by `music-streaming-distribution` (A) and `youtube-content-id-own-catalog` (A). This covers DistroKid, TuneCore, CD Baby, Spotify, Apple Music and YouTube Content ID.

- **Policy**: https://support.distrokid.com/, https://www.tunecore.com/terms, https://cdbaby.com/, https://www.spotify.com/legal/platform-rules/ and https://support.google.com/youtube/answer/2797370
- **Automate**: metadata, release scheduling and royalty reporting.
- **Human**: creative curation of each release, rights verification, and Content ID dispute or whitelist handling.
- **AI**: you need all rights. Voice clones of real artists are not allowed. Disclose AI where a store asks for it (DDEX AI credits). Spotify removes spam and mass-uploaded tracks.
- **Rules**: only claim content you exclusively own through Content ID. Do not claim public-domain material, library loops or samples. Never manipulate streams with bots or stream farms.
- **Payout**: distributor to PayPal or bank, monthly, with a low or no minimum. Stores report 2-3 months after the stream. DistroKid Content ID costs about $4.95 per song per year; its revenue split is reported inconsistently, so verify it.

### Project Gutenberg (source texts)

Used by `public-domain-derived-works` (A).

- **Policy (verified)**: https://www.gutenberg.org/policy/license.html
- **Rule**: if you sell a work under the Project Gutenberg name or license, you owe a 20% royalty on gross profits, and the trademark may not be used without permission. To avoid this, strip the license and all references to Project Gutenberg. The license only addresses US law, so verify public-domain status in each sales country (life+50 or life+70).

## Software & Developer Monetization

### GitHub

Used by `dual-license-open-source` (B), `github-sponsors` (B) and `saas-recurring-affiliate-tutorials` (A, "Blog/GitHub").

**URL**: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service. Acceptable use: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

**Key Rules**:

- Bots must identify themselves in user agent strings
- Must not abuse API rate limits
- Must not create accounts via automated means without permission. A machine user is allowed alongside a person's own account, but the person stays responsible for it.
- Must not use the platform for spam or for commercial content unrelated to development
- Bug bounty hunting is allowed only on authorized programs

**Rate Limits (verified)**:

- REST: 60 requests/hour unauthenticated; 5,000/hour authenticated (15,000 for Enterprise Cloud org apps); `GITHUB_TOKEN` 1,000/hour per repo
- Secondary: at most 100 concurrent requests; 900 points/minute for REST and 2,000 for GraphQL; content creation at most 80/minute and 500/hour
- GraphQL API: 5,000 points/hour; Search API: 30 requests/minute

**GitHub Sponsors (verified)**: https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors. Recipients must live in one of 103 supported regions. There are no fees on sponsorships from personal accounts and up to 6% on sponsorships from organizations. The catalog says payouts go through Stripe Connect monthly, after KYC and a tax form. Unsupported regions can use a fiscal host such as Open Collective.

**Best Practices for Bots**:

- Use `User-Agent: money-machine-bot (github.com/username/money-machine)`
- Implement exponential backoff on 403/429 responses and honour `retry-after` and `x-ratelimit-reset`
- Cache responses with conditional requests (ETag)

### Browser Extension Stores

Used by `paid-browser-extensions` (A).

| Store                  | Policy                                                                               | Notes                                      |
| ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Chrome Web Store       | https://developer.chrome.com/docs/webstore/program-policies                          | One-time registration fee ($5 per catalog) |
| Firefox Add-ons        | https://extensionworkshop.com/documentation/publish/add-on-policies/                 | Human review for listed add-ons            |
| Microsoft Edge Add-ons | https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies | Free registration                          |
| ExtensionPay           | https://extensionpay.com/                                                            | Stripe-backed payments library             |

- **Automate**: builds, packaging and submission through the store APIs (Chrome Web Store API).
- **Human**: developer registration and identity verification, replies to store reviews, Stripe KYC.
- **Rules**: no data harvesting, minimal permissions and a privacy policy. The spam policy forbids publishing multiple extensions that duplicate one experience.
- **Payout**: Stripe to a bank with no minimum (about 46 countries). Elsewhere use a merchant of record: Lemon Squeezy ($50 minimum) or Paddle ($100 minimum).

### WordPress.org and Freemius

Used by `wordpress-freemium-plugins` (A).

- **Policy**: https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/ and https://freemius.com/help/documentation/selling-with-freemius/your-earnings/
- **Rules**: code must be GPL. No trialware: free-directory code must not be locked. No phoning home without opt-in. No sockpuppet reviews or support accounts.
- **Human**: plugin review responses, support forum replies, seller verification.
- **Payout**: Freemius pays monthly once a small, method-dependent threshold is reached, by PayPal, Payoneer, Wise or wire. Fees are up to about 3%.

### Stripe (and payout rails)

Used by 9 strategies directly, plus "Stripe Billing" and "Stripe/Wise invoicing". Examples: `paid-browser-extensions`, `ai-micro-tools-site`, `licensed-data-api-feeds`, `niche-directory-paid-listings` and `niche-ai-agent-saas` (all A).

**URL**: https://stripe.com/legal/ssa. Restricted businesses: https://stripe.com/legal/restricted-businesses

- **Rules**: follow the Restricted Businesses list. Give clear product and refund descriptions. Unlicensed financial signals, gambling and adult content are not allowed.
- **Accounts**: KYC per account. Multiple accounts are allowed for genuinely separate businesses but not to evade a closure.
- **Risk**: start with small transactions and build history gradually. Keep detailed records and answer disputes quickly, because high dispute rates freeze accounts.
- **Payout**: rolling 2-7 days to a bank, with no platform minimum. Direct accounts are available in about 46 countries. Elsewhere use a merchant of record (Lemon Squeezy, Paddle, Polar) or Wise/Payoneer invoicing.
- **API**: default limits are about 100 operations/s in live mode and 25/s in test mode. Handle `429` with backoff and use idempotency keys on every write.

**PayPal** (https://www.paypal.com/us/legalhub/useragreement-full) is the only payout rail for RapidAPI and the main one for Salad, Honeygain and Ko-fi. Its Acceptable Use Policy is strictly enforced, and chargebacks can freeze an account. Each person may have one personal and one business account. PayPal receiving is unavailable in several reference countries (see Cross-Platform Rules).

### Lemon Squeezy and Polar (merchants of record)

Used by `micro-saas-merchant-of-record` (B), `digital-downloads-gumroad-payhip` (B), `oss-funding-opencollective-polar-thanksdev` (B), `dual-license-open-source` (B), `paid-ide-plugins` (B) and `wordpress-freemium-plugins` (A, as the alternative).

- **Policy**: https://www.lemonsqueezy.com/terms and https://polar.sh/legal/terms
- **Rules**: the merchant of record handles VAT and sales tax. The seller passes verification and must not sell restricted products.
- **Payout (Lemon Squeezy, verified)**: the minimum is $50. Payouts are created on the 1st and 15th after a 13-day hold and go to a bank or verified PayPal (always in USD). Lemon Squeezy is migrating toward Stripe Managed Payments.
- **Payout (Polar, catalog)**: Stripe Connect Express, mostly with no minimum ($30-50 in a few countries). Fees are about 4-5% plus 40-50 cents.

### RapidAPI Hub

Used by `rapidapi-api-marketplace` (A) and `licensed-data-api-feeds` (A).

- **Policy**: https://docs.rapidapi.com/docs/payouts-and-finance (provider terms apply).
- **Automate**: API hosting, metering and plan management.
- **Human**: PayPal setup, pricing decisions, support. The underlying data must be licensed for resale.
- **Payout (verified)**: PayPal only, with a flat 25% marketplace fee plus PayPal fees. A month's charges are paid at the end of the following month, so January charges arrive in early March. No minimum is published.

## Education & Tutoring

### Stuvia and Docsity

Used by `study-notes-stuvia` (A).

- **Policy**: https://www.stuvia.com/en/terms and https://www.docsity.com/
- **Rules**: original notes only. Some universities forbid selling notes from their lectures. AI-written notes passed off as lecture notes breach originality rules.
- **Payout**: bank transfer weekly on Mondays, $10 / EUR 10 minimum. Stuvia's commission is about 30%.

### Zoom

Used by `paid-webinars-workshops` (B) and `cohort-courses-maven` (C).

- **Policy**: https://explore.zoom.us/en/terms/
- **Automate**: scheduling, registration and recordings through the Zoom API (rate-limit categories depend on the plan).
- **Human**: live teaching. Tell participants when sessions are recorded.
- **Payout**: none from Zoom. Tickets are sold through Stripe, Luma, Eventbrite or Maven.

## Content & Media

### YouTube

Used by `saas-recurring-affiliate-tutorials` (A), `youtube-partner-program-ai-assisted` (B) and `youtube-content-id-own-catalog` (A, Content ID).

- **Policy**: https://www.youtube.com/t/terms. Monetization: https://support.google.com/youtube/answer/1311392. AI disclosure: https://support.google.com/youtube/answer/14328491
- **Automate**: scripting drafts, editing, captions, thumbnails and scheduling through the Data API.
- **Human**: review of every script for originality and accuracy, and the YPP application. Repetitive, mass-produced "inauthentic content" is demonetized.
- **AI (verified)**: disclose realistic altered or synthetic content (a real person saying something they did not, altered real events, realistic scenes that did not happen) through the "AI use" attribute in Studio. Disclosure is not needed for scripts, thumbnails, captions or beauty and colour edits. Repeat non-disclosure can lead to removal or YPP suspension. Disclosure alone does not reduce monetization.
- **Rules**: disclose paid promotion with the checkbox. Own the rights to all content.
- **Accounts**: multiple channels are allowed, but circumventing YPP with them is not.
- **Payout**: AdSense, $100 minimum, paid around the 21st-26th. YPP is available in 100+ countries. Creator Partnerships run in about 24 countries.
- **API**: the Data API v3 default quota is 10,000 units/day; an upload costs about 1,600 units.

### Display Ad Networks

Used by `seo-blog-display-ads` (A), `ai-micro-tools-site` (A) and `youtube-partner-program-ai-assisted` (B).

| Network           | Policy                                          | Minimum / terms (catalog)                   |
| ----------------- | ----------------------------------------------- | ------------------------------------------- |
| Google AdSense    | https://support.google.com/adsense/answer/48182 | $100; EFT/wire around the 21st              |
| Ezoic             | https://www.ezoic.com/terms/                    | ~$25 typical for premium networks           |
| Mediavine Journey | https://www.mediavine.com/                      | Net-65                                      |
| Raptive           | https://raptive.com/                            | Net-45; traffic bar lowered to 25,000 views |

- **Rules**: no invalid traffic, and never click your own ads or automate visits. Auto-generated thin pages are not allowed (https://developers.google.com/search/docs/essentials/spam-policies, scaled content abuse). EU, UK and Canadian traffic needs a cookie consent management platform and a privacy policy.
- **Accounts**: one AdSense account per payee; many sites can sit under one account.

### Amazon KDP (incl. Kindle Unlimited and Virtual Voice)

Used by `kdp-ebooks-low-content` (A), `public-domain-derived-works` (A) and `audiobooks-ai-narration` (A).

- **Policy**: https://kdp.amazon.com/en_US/help/topic/G200672390 (content guidelines)
- **Automate**: manuscript and cover drafts, metadata and royalty reports. KDP has no public upload API.
- **Human**: the KDP account and tax interview, human review of each manuscript, and manual upload in the KDP UI.
- **AI (verified)**: disclose AI-generated text, images or translations when publishing or republishing, even if they were heavily edited. AI-assisted content (your own work refined with AI) need not be disclosed.
- **Rules**: no trademarked or copyrighted material. The catalog reports a cap of 3 titles per day; that cap is not on the official guideline page. Kindle Unlimited requires exclusivity (KDP Select). Virtual Voice AI narration is US-only and invite-based.
- **Accounts**: one KDP account per person.
- **Payout**: EFT with no minimum in most marketplaces ($100 for wire or check), about 60 days after month end.

### Audiobook Distributors

Used by `audiobooks-ai-narration` (A).

| Platform          | Policy                                                           | AI narration                                                          |
| ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| ACX               | https://help.acx.com/s/article/acx-audio-submission-requirements | Unauthorized TTS/AI prohibited (verified); US/UK/CA/IE rights holders |
| Google Play Books | https://play.google.com/books/publish/autonarrated/              | Google auto-narration allowed; broad country coverage                 |
| Voices by INaudio | https://inaudio.com/                                             | Accepts AI narration with disclosure; PayPal payout                   |
| KDP Virtual Voice | See Amazon KDP                                                   | Amazon's own AI voice; US-only and invite-based                       |

- **Payout**: $0-$10 minimum, paid monthly 30-60 days after month end. You need audio rights to the text.

### Newsletter Platforms (beehiiv, Substack, Ghost)

Used by `newsletter-sponsorships-ad-network` (A), `newsletter-ad-network-boosts` (B), `paid-newsletter-subscriptions` (B), `gated-membership-site` (B) and `public-data-scraping-service` (A, Substack).

- **Policy**: https://www.beehiiv.com/tou, https://substack.com/tos and https://ghost.org/terms/
- **Automate**: drafting, scheduling and list hygiene.
- **Human**: editorial review of every issue, and negotiating sponsors.
- **Rules**: label sponsored content. Follow CAN-SPAM and GDPR/PECR: double opt-in and a working unsubscribe. Never import scraped lists. beehiiv bans fake or incentivized clicks on Ad Network placements.
- **Payout**: beehiiv Ad Network pays through Stripe Express with no fixed minimum, but needs a qualifying paid plan. Substack and Ghost pay paid subscriptions to Stripe on a rolling basis. Substack has special handling for India, Brazil, Indonesia, Mexico, Malaysia and Thailand.

### Meta (Facebook and Instagram)

Used by `meta-facebook-instagram-content-monetization` (B), `shopify-dropshipping` (B, ads) and `used-goods-reselling` (S, Marketplace).

- **Policy**: https://www.facebook.com/business/help/1348682518563619 (Partner and Content Monetization Policies)
- **AI**: label photorealistic AI content ("AI info").
- **Rules**: no unoriginal reposts. The Graph API publishes only to Business and Creator accounts. Automated likes, follows and DMs are prohibited.
- **Payout**: $100 minimum, around the 21st of the month, to a bank or PayPal (some countries).

### TikTok

Used by `tiktok-creator-rewards` (C), `tiktok-shop-affiliate` (C) and `shopify-dropshipping` (B, ads).

- **Policy**: https://www.tiktok.com/legal/page/us/terms-of-service/en
- **AI**: AI-generated content must carry the AIGC label. Commercial and affiliate content needs the disclosure toggle.
- **Accounts**: 18+ (19+ in South Korea), with a real identity in an eligible country.
- **Payout**: Creator Rewards has a $10 in-app minimum and covers only about 8-10 markets. TikTok Shop pays through the creator wallet after the return window.

## Services & Freelancing

### Fiverr

Used by 10 strategies, including `data-cleaning-conversion-gigs`, `seo-audit-productized`, `transcription-subtitles-human-qa`, `website-in-a-day`, `resume-linkedin-rewriting` and `local-business-chatbot-setup` (all A).

**URL**: https://www.fiverr.com/terms_of_service. AI policy: https://help.fiverr.com/hc/en-us/articles/37333379620369

**Key Rules**:

- One account per person, with an ID check
- Must deliver services as described and within the deadline
- No automation of communication (must respond personally)
- No external links or off-platform payment in contact
- Gig fulfillment can be automated if quality is maintained
- Fiverr AI standards: disclose AI use to buyers and use tools with commercial-rights licences. Cloning another person's voice without consent is prohibited.
- Never fabricate credentials, for example in resumes. Do not claim guaranteed rankings or use link schemes in SEO gigs.

**Automation Considerations**:

- Can automate: service delivery, file processing, analysis, first-draft generation
- Cannot automate: customer communication, account creation, gig listing creation
- Must QA every delivery and handle disputes personally

**Payout (catalog)**: Fiverr takes a 20% fee and holds funds for 14 days. Withdrawal minimums are $1 to PayPal and $20 to a bank through Payoneer, on demand. Payoneer reaches almost every country; PayPal receiving is missing in some, such as Bangladesh.

### Upwork

Used by 13 strategies, including `ai-automation-agency`, `ai-voiceover-podcast-editing` and `newsletter-social-content-retainer` (all A).

**URL**: https://www.upwork.com/legal

**Key Rules**:

- Freelancers must be real individuals, with one freelancer account per person. No account sharing or renting.
- Must personally perform work or clearly indicate subcontracting
- All communication must be genuine
- No automated bidding or bot-written proposals sent without review
- Can use tools, including AI, to perform work if the client's AI policy allows it. Do not misrepresent AI output as something else. Upwork updated its global ToS alongside its own AI agent in 2026.

**Automation Considerations**:

- Can automate: actual work delivery, reporting
- Cannot automate: proposals, client communication
- Hybrid approach: human oversight plus automated execution

**Payout (catalog)**: fees are 0-15%. Withdrawals go by ACH, local bank, Payoneer or PayPal in 180+ countries.

### Contra

Used by 7 strategies, including `ai-automation-agency`, `website-in-a-day` and `seo-audit-productized` (A).

- **Policy**: https://contra.com/terms. Payouts: https://help.contra.com/en/articles/10008642-payout-methods-on-contra
- **Automate**: portfolio and project delivery. Client communication stays human, as on Fiverr and Upwork.
- **Payout**: 0% commission for freelancers; processor fees apply. Payouts go through Stripe in 100+ countries, plus PayPal or USDC.

### Make, Zapier and n8n (automation tooling)

Used by `ai-automation-agency` (A).

- **Policy**: https://www.make.com/en/solution-partners, https://zapier.com/legal and https://github.com/n8n-io/n8n/blob/master/LICENSE.md
- **License (verified)**: n8n's Sustainable Use License allows use "only for your own internal business purposes or for non-commercial or personal use". Building workflows on a client's own n8n instance is the safe path. Selling hosted n8n access to clients needs a commercial or Embed license.
- **Rules**: sign a DPA with clients for personal data, and keep cold outreach within CAN-SPAM, GDPR/PECR and CASL.
- **Payout**: direct invoicing through Stripe or Wise. Make and n8n also run affiliate programs.

## Community & Memberships

### Ko-fi and Buy Me a Coffee

Used by `kofi-buymeacoffee-tips` (A).

- **Policy**: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-Take-a-Fee and https://buymeacoffee.com/terms
- **Automate**: posting free content that motivates tips, and thank-you messages that are labelled as automated.
- **Rules**: no fake supporters and no self-tipping to inflate rankings. Tips are taxable.
- **Payout**: $0 minimum; money goes straight to PayPal or Stripe. Processor fees are about 3% + $0.30. Buy Me a Coffee charges 5% (not re-verified).

### Discord

Used by `paid-chat-community` (B) and `discord-premium-ai-bot` (B).

- **Policy**: https://discord.com/developers/docs/policies-and-agreements/developer-policy
- **Rules**: bots must be clearly labelled as apps. No selling data and no message logging beyond what the app needs. A privacy policy is required. Self-bots on user accounts are banned.
- **Payout**: native Premium Apps are limited to US, UK and EU developers and pay through Stripe within 45 days after month end, after a $100 eligibility threshold.
- **API**: global limit of 50 requests/s per bot, plus per-route buckets. Honour `X-RateLimit-*` headers.

## Affiliate & Performance Marketing

Shared rules: disclose on every page or post (FTC/CAP). No self-referrals, cookie stuffing, trademark bidding or incentivized clicks unless the program allows them. Commissions lock after the merchant's validation or return window (30-120 days).

### Amazon Associates

Used by `pinterest-affiliate-pinning` (A), `amazon-associates-comparison-site` (B) and `amazon-influencer-shoppable-videos` (C).

**URL**: https://affiliate-program.amazon.com/help/operating/agreement

- Disclose the affiliate relationship clearly on every page or post that has links.
- Links must appear in a relevant context. Do not incentivize clicks, and do not use links in email or offline.
- Do not show Amazon prices unless they are pulled live from the Product Advertising API or Creators API.
- New accounts close if they do not make 3 qualifying sales within 180 days.
- Claims about products must be first-hand. Reviews must be genuine, not fake or incentivized.
- **Payout (verified)**: about 60 days after month end, by direct deposit, gift certificate or check. The US threshold is $10; the UK is GBP 25. Each Amazon store has its own program.

### Affiliate Networks

Used by `coupon-deal-aggregator-site` (A), `saas-recurring-affiliate-tutorials` (A), `pinterest-affiliate-pinning` (A) and `affiliate-network-programmatic-seo` (B).

| Network                   | Policy                                                                                          | Minimum payout (catalog)            |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| Awin                      | https://success.awin.com/articles/en_US/Knowledge/What-are-the-payment-thresholds               | GBP/EUR/USD 20, twice monthly       |
| CJ Affiliate              | https://www.cj.com/ (publisher terms)                                                           | $50 direct deposit                  |
| Impact.com                | https://impact.com/ (partner terms)                                                             | $10, PayPal or bank                 |
| LTK                       | https://company.shopltk.com/                                                                    | Reported $25-$100; creator approval |
| PartnerStack              | https://partnerstack.com/ (partner terms)                                                       | ~$5, PayPal or Stripe               |
| Rewardful / FirstPromoter | Vendor-hosted program terms                                                                     | Set by each vendor ($0-$50)         |
| Skimlinks                 | https://support.skimlinks.com/hc/en-us/articles/223835448-Payment-Schedule-When-will-I-get-paid | $65 / EUR 55 / GBP 50               |
| Sovrn Commerce            | https://www.sovrn.com/ (legal pages)                                                            | ~$25                                |

- **Coupons**: publish only codes the merchant authorized. Fake or leaked codes break consumer-protection law. Google treats white-label coupon sections as site reputation abuse.
- **Automate**: link building and deal feeds through the network APIs. Approval for each merchant is a human step.

### Pinterest and Tailwind

Used by `pinterest-affiliate-pinning` (A).

- **Policy**: https://policy.pinterest.com/en/community-guidelines and https://policy.pinterest.com/en/developer-guidelines. Tailwind: https://www.tailwindapp.com/terms
- **Automate**: scheduling pins through the official API or Tailwind, which is an approved partner.
- **Rules**: no link cloaking, deceptive redirects, repetitive pins or mass-created accounts. The account must claim the website it links to.
- **API (verified)**: Trial access allows 1,000 requests/day. Standard access allows 100 requests/s per user per app, with category limits (for example `org_write` 100/minute).
- **Payout**: Pinterest does not pay; the affiliate network does.

### Newsletter and Podcast Sponsorship Marketplaces (Paved, Passionfroot, Podcorn)

Used by `newsletter-sponsorships-ad-network` (A), `video-podcast-sponsorship-marketplaces` (C) and `podcast-monetization` (C).

- **Policy**: https://www.paved.com/, https://www.passionfroot.me/ and https://podcorn.com/
- **Rules**: label sponsored content and disclose sponsor reads out loud in podcasts. Follow the brand contract.
- **Payout**: per completed booking, to a bank or PayPal. Paved reportedly takes about 30%. Brands favour English-language audiences.

### Fintech Referral Programs (Wise, Revolut, Payoneer, Interactive Brokers)

Used by `fintech-referral-bonuses` (A).

- **Policy**: https://wise.com/uk/help/articles/77zvWSO4tKdGobXrgHIJAA/how-does-the-standard-invite-program-work, https://www.revolut.com/en-US/legal/referrals-terms/, https://www.payoneer.com/legal/ and https://www.interactivebrokers.co.uk/en/accounts/referrer.php
- **Rules**: you must hold a real account in each app. No self-referrals. Financial-promotion rules apply (for example UK FCA): stay factual, add risk warnings, give no personalised advice, and avoid crypto and leveraged products.
- **Payout**: credited in the app per qualifying referral, with no minimum. Each app is licensed only in certain countries. The IBKR referral program excludes Japan, Spain and Israel.

## Digital Products

### Etsy

Used by `spreadsheet-templates-calculators` (A), `etsy-digital-printables-svg` (B), `photo-presets-luts` (B), `canva-templates` (B) and `print-on-demand-own-shop` (B).

- **Policy**: https://www.etsy.com/legal/ and Creativity Standards at https://www.etsy.com/legal/creativity
- **Automate**: listing drafts, and inventory and order sync through Open API v3.
- **Human**: shop identity and bank verification, an originality and IP check of each design, and buyer messages.
- **AI**: AI-generated designs go under "Designed by", and the AI use must be disclosed in the listing. Trademarked or copyrighted characters are not allowed.
- **Accounts**: multiple shops are allowed if each follows policy. Opening a new shop to evade a suspension is not.
- **Payout**: Etsy Payments to a bank on a schedule you choose, with no fixed minimum. New sellers may face reserves. Payouts are only available in listed countries, some through Payoneer (Ukraine, India, Japan, Thailand, Argentina, Peru).
- **API (verified)**: limits are set per API key and shown in the Developer Portal. The documented example is 150 QPS and 100,000 QPD, with QPD on a rolling 24-hour window.

### Gumroad and Payhip

Used by `public-domain-derived-works` (A), `spreadsheet-templates-calculators` (A), `digital-downloads-gumroad-payhip` (B), `notion-templates` (B), `photo-presets-luts` (B) and `design-assets-fonts-icons-ui-kits` (C).

- **Policy**: https://gumroad.com/terms and https://payhip.com/terms
- **Automate**: product and file updates, and license-key delivery through the APIs or webhooks.
- **Human**: KYC, payout linking, quality review of product content.
- **Rules**: both act as merchant of record and collect VAT. You must hold the copyright of everything included.
- **Payout**: Gumroad pays weekly through Stripe or PayPal. The minimum is $10; the catalog reports $100 for unverified accounts since 2026, not verified. Payhip pays instantly to PayPal or Stripe with no minimum.

### Creative Market

Used by `photo-presets-luts` (B), `canva-templates` (B) and `design-assets-fonts-icons-ui-kits` (C).

- **Policy**: https://creativemarket.com/terms
- **Human**: shop application approval, and vector or kerning QA.
- **Rules**: original work only, with no derivative fonts. Preview images must be your own.
- **Payout**: $20 minimum, by PayPal (free in the US, 1% up to $10 elsewhere) or bank.

## Micro-Tasks & Paid Research

### HackerOne and Bugcrowd

Used by `bug-bounty-programs` (C) and `ai-redteam-bounties` (C).

- **Policy**: https://www.hackerone.com/policies/terms and https://www.bugcrowd.com/ (platform terms)
- **Automate**: scanners only within the program scope and at its stated automation and rate limits.
- **Human**: manual validation, report writing, triage replies, NDAs.
- **Rules**: testing outside scope is a computer-crime offence. Payouts are blocked to OFAC-sanctioned persons and banks.
- **Payout**: HackerOne has no PayPal minimum, $50 for local bank and $100 for SWIFT. Bugcrowd pays in weekly batches.

### Outlier (Scale AI)

Used by `generalist-rlhf-ai-training` (C) and `expert-ai-training` (C).

- **Policy**: https://outlier.ai/
- **Human**: tasks must be done by the worker personally. AI-generated submissions are forbidden and lead to removal.
- **Accounts**: one per person, with an ID check. Projects restrict which countries they accept (about 50-61 countries).
- **Payout**: PayPal or Airtm, weekly on Tuesdays, with no minimum.

## Legal Frameworks

**CAN-SPAM (US)**: accurate "From" information, clear subject lines, the message identified as an ad, a physical address, and opt-outs honoured within 10 days. You are responsible for what others send on your behalf.

**GDPR (EU) and UK GDPR**: a lawful basis for processing, data subject rights (access, correction, deletion), data minimization, security, privacy by design, and a DPA with every client whose personal data you process. PECR/ePrivacy require consent for marketing email.

**Advertising disclosure**: FTC Endorsement Guides (US) and CAP Code/ASA (UK) cover affiliate and sponsored content.

**AI transparency**: the EU AI Act requires chatbots to tell users they are AI and synthetic media to be labelled. Some US states have bot-disclosure laws.

**Marketplace income reporting**: DAC7 (EU) and Form 1099-K (US) apply above their thresholds.

**General compliance**: do not offer services that need a licence (financial advice, legal services, certified translation, tax advice). Income is taxable. Consumer protection and intellectual property laws apply.

## Rate Limiting Strategy

To respect all platforms, implement:

1. **Global Rate Limiter**: Track requests across all platforms
2. **Per-Platform Limits**: Respect individual platform limits (table above and below)
3. **Exponential Backoff**: Handle 429/403 errors and honour `Retry-After`
4. **Request Queuing**: Batch requests efficiently
5. **Cache Everything**: Minimize redundant requests

```javascript
// Platform-specific configuration (verify against current docs before use)
const PLATFORM_LIMITS = {
  github: { requestsPerHour: 5000, concurrent: 100, writesPerMinute: 80 },
  pinterest: { trialPerDay: 1000, standardPerSecondPerUser: 100 },
  etsy: { perSecond: 'per key (Developer Portal)', perDay: 'per key' },
  shopify: {
    graphqlPointsPerSecond: 100,
    restBucket: 40,
    restLeakPerSecond: 2,
  },
  printful: { requestsPerMinute: 120 },
  stripe: { liveOpsPerSecond: 100, testOpsPerSecond: 25 },
  youtube: { quotaUnitsPerDay: 10000 },
  discord: { globalPerSecond: 50 },
};

// Before any platform action:
// 1. Check that the action is allowed for automation on that platform (see "Automate")
// 2. Verify rate limit availability
// 3. Log the action for the audit trail
// 4. Execute with error handling
// 5. Update the rate limit counter
```

## Monitoring and Compliance

The money-machine should:

1. Log all platform interactions
2. Track rate limit usage
3. Monitor for ToS violations and policy-change announcements
4. Automatically pause if limits are approached or an account receives a warning
5. Generate compliance reports, including the AI-disclosure status of every published asset

## Updates Required

Review and update this document:

- Monthly: check for ToS, AI-policy and payout-threshold changes, especially items marked as catalog-only or unverified
- When adding new platforms or catalog strategies
- After any platform change
- When legal frameworks change

## Resources

- Strategy catalog: `data/strategies.json` (fields `platforms`, `payout`, `legality`, `availability`, `sources`)
- ToS;DR (Terms of Service; Didn't Read): https://tosdr.org/
- Platform API documentation (always authoritative)
- Legal consultation for specific jurisdictions
