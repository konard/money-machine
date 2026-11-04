# Untranslated entries and sense regressions

Production uses public dictionary data plus `formal-ai/data/overrides`. No word-specific translations or runtime dependencies were added. Measurements compare the starting translator with the current shared workspace; concurrent grammar changes are included in the final measurements.

## Changes

- `src/sources/russian-meanings.mjs`: reuse Russian Wiktionary requests and its existing cache for English headwords; keep POS boundaries, exclude examples and other languages, reject descriptive relative clauses, and protect existing inflections and translated participles. Only unambiguous Russian meanings fill an English sense.
- `src/sources/definition-verbs.mjs` and `definition-translations.mjs`: translate conservative definition frames with their objects and prepositions. Choose a noun sense using its definition context; use attested adjective translations or rendered participles for adjective glosses.
- `src/sources/translation-morphology.mjs`, `government.mjs`, `src/resolve.mjs`, and `src/russian/naturalize.mjs`: inflect the Russian verb head before attaching its fixed complement, retain recipient government, and reuse a known Russian paradigm without copying another sense's argument roles.
- `src/senses.mjs`, `sense-data.mjs`, `translation-senses.mjs`, and `terms.mjs`: remove the blanket plural-synonym bonus, weaken incidental reverse-definition cues, recognize agent/activity derivations, respect comparison boundaries, preserve explicitly intransitive verbs, and normalize an exactly matched public compound's plural head.
- `src/sources/compact.mjs`: retain Russian Wiktionary English entries in recorded fixtures.
- `tests/formal-ai/untranslated.test.mjs`: offline API fixtures and regression tests; `domain-senses.test.mjs` now rejects a preference based on plurality alone. `scripts/record-fixtures.mjs` adds six untranslated-word examples to production replay.

## Requested examples

All ten examples were checked in separate processes with the supplied `try.mjs` harness and an isolated baseline copy. The four sense regressions also appear in the production recording. Residual grammar problems are shown rather than hidden.

| English                                                     | Before                                                              | After                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| They trademarked the name.                                  | Они [trademarked the name].                                         | Они зарегистрировали как товарный знак имя.                                        |
| Use trademarked images.                                     | Используйте [trademarked images].                                   | Используйте зарегистрированные как товарный знак образы.                           |
| Use copyrighted images.                                     | Используйте [copyrighted images].                                   | Используйте покрытые авторским правом образы.                                      |
| Use trademarked/copyrighted images.                         | Используйте или образы [trademarked copyrighted].                   | Используйте зарегистрированные как товарный знак/покрытые авторским правом образы. |
| Billed monthly.                                             | Ежемесячный [Billed].                                               | Посланный счёт ежемесячник.                                                        |
| You are billed per seat.                                    | Вы [billed per seat].                                               | Вам посылают счёт за сиденье.                                                      |
| Small businesses pay because the work is tedious.           | Зарплаты малого бизнеса, потому что работа нудна.                   | Малые бизнесы платят, потому что работа нудна.                                     |
| The children play in the park.                              | Дети играются в парке.                                              | Дети играют в парке.                                                               |
| Requires sharing location history for many surveys.         | Делить историю положения для съёмок [Requires].                     | Делить историю положения для многих опросов [Requires].                            |
| Some sites also exclude people working in law or insurance. | Несколько мест исключают людей тоже или страховка [working in law]. | Несколько сайтов исключают людей тоже или страховка [working in law].              |

## Measurements

| Website seed | Before | After |
| ------------ | -----: | ----: |
| 7            |   8/15 |  9/15 |
| 11           |   9/15 |  9/15 |
| 23           |   7/15 |  8/15 |
| 4411         |  11/15 | 11/15 |
| Total        |  35/60 | 37/60 |

All 60 sampled sentences were compared. Improvements include resolving `disbursing`, `copyrighted`, and `audio`; persistent fragments and awkward word choices remain. Completion measures parsing, not translation quality.

Generalization, seed 20261104, N=100: chrF **44.938 → 44.977**; completion **80% → 80%**.

Production snapshot was recreated after deleting `tests/formal-ai/fixtures/public`: **76 live/offline translations identical**, 26.42 MiB of compact public responses. The expected-output diff was reviewed; the known irregular motion paradigm and the research reading of “studies” are preserved.

Validation: full Node test suite **345 passed**, ESLint passed, and `npm run check:file-size` passed. Twelve added offline tests cover the fallback and its regressions.

## Remaining problems

- “Billed monthly.” resolves its vocabulary but is still parsed as a noun phrase: «Посланный счёт ежемесячник».
- “Per seat” remains literal «за сиденье»; “images” defaults to «образы».
- “Small businesses” now keeps the verb reading «платят», but the noun phrase is «малые бизнесы», rather than the desired «малые предприятия».
- The pre-existing fragments around “Requires” and “working in law” remain.
- “Billing runs through Shopify…” now resolves “billing” but still misparses the clause («Посылать счёт бегам…»); resolving a word does not establish a correct sentence translation.
- Complex or ambiguous dictionary definitions outside the supported frames remain untranslated; the Russian fallback deliberately avoids assigning an unaligned meaning to multiple English senses.

English Wiktionary returned HTTP 429 during measurement. Existing raw public pages were reused across cached request batches by a temporary development harness; the final recording itself ran with the normal production command and verified replay with an empty cache. No temporary harness or translation lists were added to production.
