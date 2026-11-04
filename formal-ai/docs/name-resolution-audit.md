# Name resolution audit

Evaluated on 2026-11-04. No per-name translations were added.

## Changes

- `src/name-resolution.mjs`: score exact labels/aliases with logarithmic popularity and contextual evidence; prefer commercial organizations over personal names in commercial prose; gate acronym expansions; discard stale name declensions when selecting another entity; compose declensions for Cyrillic multiword labels.
- `src/sources/entity-context.mjs`: bound nearby evidence to 200 characters on either side; distinguish semantic description/instance evidence from incidental aliases and country associations; recognize commercial context and organization descriptions/types.
- `src/resolve.mjs`: let Wikidata reconsider names learned from the dictionary.
- `src/english/analyze.mjs`: preserve a resolved commercial entity at sentence start, ahead of a dictionary common-word sense.
- `src/sources/compact.mjs`: retain ISO country-code claims used as country evidence in recorded responses.
- `tests/formal-ai/name-context.test.mjs`: seven offline tests using stubbed public API responses, including an existing dictionary transliteration and surname paradigm.

## Seed 4242: 30 website sentences

Command: `node formal-ai/scripts/sample.mjs sentence 30 4242`.

[Full before](name-resolution-audit/4242-before.txt) and [full after](name-resolution-audit/4242-after.txt).

The original name resolver was also replayed against the current concurrent parser changes to isolate this task's effects. Live Wikimedia requests returned HTTP 429. Evaluations used the existing cache and public fixtures; where a new request only regrouped recorded pages/entities, those recorded records were regrouped locally. Missing pages remained missing. These are cached-data comparisons, not a fresh live-source audit.

28 Russian outputs are identical. Two improve; completion stays 25/30:

| Sentence                                                           | Before                                                         | After                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| 21, bank-account signup bonuses: “in the UK, CASS switch bonuses…” | «в Кентуккийский университет … Академия общественных наук КНР» | «в Великобритании … CASS»                    |
| 15, platform rules                                                 | «Ме́та … прозрачность Закон Евросоюза об ИИ»                    | «Meta … прозрачность Закона Евросоюза об ИИ» |

KDP, TikTok, Santander and the other names in the sample remain unchanged. The bank sentence still has unrelated lexical/grammar errors, including «премии выключателя» and the incomplete Barclays phrase.

## Website context probes

[Before records](name-resolution-audit/website-before.jsonl) and [after records](name-resolution-audit/website-after.jsonl) contain the source page, sentence, Russian output and selected entity. Names were resolved with the whole source page as context, using the sample's resolved vocabulary. The Russia case uses “I work in Russia.” as a short declension probe against the page mentioning Russia.

| Source/context                                                      | Before                                                                 | After                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| `docs/research/platform-rules.md`, CASS switching offers            | Academy of Social Sciences, Q1073828; «Академия общественных наук КНР» | CASS retained verbatim; no unsupported expansion |
| `docs/business-plans/rent-gpu-vast-ai.md`, Wise payout rail         | Wise, Q7833987                                                         | Wise, Q7833987                                   |
| `strategies.json#mobile-apps-iap-ads`, “Apple pays within 45 days…” | album Q1754545, Latin surface Apple                                    | company Q312, Latin surface Apple                |
| `docs/business-plans/direct-ad-space-dev-sites.md`, US/EU           | Ege University, «Эгейский университет»                                 | European Union, «ЕС»                             |
| US probe                                                            | «США»                                                                  | «США»                                            |
| Russia declension probe                                             | «Я работаю в России.»                                                  | «Я работаю в России.»                            |
| Google Play probe                                                   | «Кредит Google Play (Android)»                                         | same                                             |
| PayPal probe                                                        | PayPal (wrong entity Q136653753)                                       | PayPal (company Q483959)                         |
| Payoneer probe                                                      | Payoneer, Q7156870                                                     | same                                             |

The selected short Wise website excerpt was already correct before the change. Its surname failure is covered separately by an offline fixture: a pre-existing «Уайз» label and masculine paradigm are replaced with Latin Wise when the payment-company entity fits commercial context. Another fixture seeds a dictionary «Эпл» noun sense and verifies that “Apple pays developers.” is analyzed as the company name, overriding that dictionary sense. A third verifies «Кентуккийский университет» → «Кентуккийском университете».

## Validation and remaining limitations

- Prettier applied to changed code/tests.
- `npx eslint formal-ai tests`: passes.
- `npm run check:file-size`: passes.
- `node --test --test-timeout=60000 tests/`: 474 pass, 1 fails. The sole failure is production translation replay, which lacks a recorded Wiktionary declension batch («Биллинг», «Фискаль», «Том»). The original resolver also fails replay on a missing batch containing these labels plus «Гуд»; the corresponding previously cached fixture was deleted in the concurrent work. Those other changes/fixtures were left intact.
- Website excerpts still exhibit unrelated parser/sense errors; this change improves name identity and inflection, not overall sentence translation.
- Sparse descriptions/types can leave an acronym unresolved. Country-code evidence and well-established Cyrillic abbreviations preserve familiar geographical names. No brand transliterations are invented.
