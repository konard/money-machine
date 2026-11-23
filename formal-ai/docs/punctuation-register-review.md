# Russian punctuation and register review

Punctuation and clause remarks are fixed. Price-sense selection is **partially fixed**; the standalone pricing examples below still need work. No word-specific translation rules were added.

## Concrete before/after

| English                      | Before                                           | After                                             |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Use cheap tools, e.g. Canva. | Используйте дешёвые инструменты, например Canva. | Используйте дешёвые инструменты, например, Canva. |
| (e.g. eBay)                  | Например eBay                                    | (например, eBay)                                  |
| It is free (optional).       | Свободно (необязательно).                        | Свободно (необязательно).                         |
| Free tier available          | Освободите ярус [available]                      | Свободный ярус доступен                           |
| a free plan                  | Свободный план                                   | Свободный план                                    |
| Pay via PayPal (optional).   | Платите через PayPal (необязательный).           | Платите через PayPal (необязательно).             |
| income (low, median, high)   | Доход (низкий, медианный, высокий)               | Доход (низкий, медианный, высокий)                |
| A free subscription.         | Свободная подписка.                              | Бесплатная подписка.                              |

The first seven examples were also checked together through the production CLI. The subscription comparison uses cached production dictionary entries. Bare “free plan” and “It is free” still select the wrong sense for the intended pricing meaning. “Tier” also remains «ярус» rather than a commercial tariff level.

## Changes

- `src/russian-entry.mjs`: learn Russian parenthetic status from English Wiktionary gloss/usage templates and Russian Wiktionary «вводное слово» / «вводн.» annotations. No Russian word list.
- `src/resolve.mjs`, `src/sources/government.mjs`: fetch full adverb phrases as optional metadata lookups; preserve existing single-word request batches. Unavailable phrase annotations do not abort otherwise usable translations.
- `src/russian/parenthetic.mjs`, `src/russian/naturalize.mjs`: mark the selected parenthetic adverb occurrence and insert commas after rendering. Homonymous predicates stay unmarked. Preserve parentheses, decimal commas, existing commas, and opening/closing punctuation.
- `src/english/parser.mjs`, `src/formalize.mjs`, `src/russian/phrase.mjs`: retain whether a parenthesis is final. A final adjective remark after a bare name uses an attested neuter short form; noun-bound adjective lists retain agreement.
- `src/english/clause.mjs`: preserve initial parentheses and let a complete omitted-copula headline outrank an incomplete imperative.
- `src/sense-context.mjs`: allow adjective senses without domain labels to use distinctive definition overlap with nouns. This selects the payment sense next to the dictionary definition of “subscription”.
- `src/sources/sense-data.mjs`: an adjective sense explicitly defined on the original page is not penalized as merely related when its matching translation table lives on another page.
- `src/english/analyze.mjs`: tolerate fixture concepts without a `classes` array in the concurrently added currency check.
- `tests/formal-ai/punctuation-register.test.mjs`: six offline tests, including stubbed public APIs, User-Agent checks, multiword metadata, punctuation boundaries and homographs, short-form agreement, delegated adjective senses, and headline parsing.

## Price investigation

The payment sense is present in public data: “obtainable without payment” delegates to “free of charge”, whose translation is «бесплатный». It had been marked as a related translation and penalized by 0.5. Removing that classification error helps context compete, but does not establish the intended meaning of every bare occurrence. The public noun definitions loaded for “plan” describe intended actions/drawings; those for “tier” describe a layer/rank. They do not supply subscription/payment overlap.

An experimental Russian Wikipedia adjective–noun collocation lookup was removed: it favored «свободный план» and added requests without improving that production example. The retained solution uses dictionary definitions and the existing document-context scoring.

Ten actual website occurrences were inspected: “Free FX market”, “Launch free list”, “Create free profile”, “Enter contests (free)”, “Registration is free”, “Receive free share/cash”, “commoditized by free tools”, “Competition from free scores”, “Publish free + gated content”, and “An EIN is free and optional”. The FX example concerns freedom; the others concern price. The cache-only translation audit could not resolve every lookup for eight of these snippets, so those outputs are recorded as incomplete evidence, not successful production checks. They confirm that blanket replacement would be wrong and that broader price-context work remains.

## Two seeded samples

Each seed selects 30 website sentences using the existing sample harness. Wikimedia intermittently returned HTTP 429. Cached public responses, plus a small successfully fetched missing-page batch, supplied the review data. Before and after use the same frozen public lexicon, topic, and website field to isolate grammar/rendering/scoring from concurrent lookup changes.

| Seed  | Complete before | Complete after | Changed outputs |
| ----- | --------------- | -------------- | --------------- |
| 73    | 20/30           | 20/30          | 2               |
| 48173 | 21/30           | 21/30          | 3               |

No regressions were found in the five changed outputs. They improve the Kick payment clause, “universal” versus “cosmic” jailbreak, handover “files”, preservation of a parenthesized score, and «(например, ≈10%)». Existing incomplete sentences remain incomplete. This controlled sample does not independently validate changes to public-data acquisition or delegated-sense classification.

All 60 English sentences and their before/after Russian, the concrete examples, and the ten website snippets are retained in [punctuation-register-samples.json](./punctuation-register-samples.json).

## Validation

- Prettier run on changed files.
- `npx eslint formal-ai tests`: pass, no warnings.
- `npm run check:file-size`: pass.
- Offline task tests: 6/6 pass.
- `node --test --test-timeout=60000 tests/`: **447/448 pass**. The sole failure is production replay requesting a public response absent from the recorded fixtures while concurrent source/fixture work is ongoing. Fixtures were not replaced to conceal this failure.

No commits were made by this task.
