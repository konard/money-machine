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

## Round 2: empty tables, derivation, and hyphenated heads

No per-word translation overrides or runtime dependencies were added. Public lookups keep the existing User-Agent. The following source gaps explain the failures:

- `base` has empty Russian verb tables. Inline `{{syn}}` references were ignored, and the Russian-headword fallback rejected its multiple meanings. `reverse-verbs.mjs` searches Russian Wiktionary and accepts only an exact English translation on a Russian entry, recovering both `base` and `license`. `synonyms.mjs` also follows sense-aligned inline synonym templates when direct translations and translation delegation are unavailable.
- `based` and `licensed` have no usable adjective translation. `productive-definitions.mjs` derives passive adjectives from newly recovered verbs, using rendered perfective partners or the productive Russian `-ировать → -ированный` class. Short passive agreement stays referential in `copula.mjs`; existing translated verb/participle readings remain intact.
- `serialize` lacks Russian tables, including for the publishing meaning. `definition-adjuncts.mjs` composes its publishing definition with a plural manner complement, following plural/spelling/translation links and selecting the complement by definition context. Its passive adjective retains the fixed complement.
- `lawfully` has no translation table. The adjective-backed manner derivation obtains `lawful → законный → законно`, preserving direct adverb translations.
- `sign-up` has only an action-noun definition. `definition-actions.mjs` follows the phrasal predicate and its explicit synonyms, then validates the Russian nominalization against an actual noun entry.
- `per-class`, `self-paced`, and `teacher-authors` lacked whole entries and usable composition rules. `hyphenated.mjs` handles distributive `per-`, a reflexive nominal head, and animate noun appositions, including plural/case forms for both heads.
- `billion` was excluded because its English and Russian entries use Numeral headings. `public-expressions.mjs` supplies the nominal English reading; `wiktionary.mjs` accepts a Russian numeral's noun declension table and uses explicit numeric magnitude to avoid long-scale sense labels.

`definition-translations.mjs` orchestrates these fallbacks; `compact.mjs` retains reverse English translations in Russian-page recordings. `resolve.mjs` passes through passive agreement. The unchanged phrasal-candidate helper moved into `compounds.mjs` to keep the resolver below 1000 lines. General safeguards in `subject-phrases.mjs` and `imperative-start.mjs` prevent new adjective/verb homonyms from displacing existing finite verbs or turning compound subjects into commands.

### Concrete before/after

| English                          | Before                                 | After                                                                      |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| It is based on sales.            | Оно [based on sales].                  | Оно базировано на продажах.                                                |
| A licensed broker sells it.      | Посредник продаёт его [A licensed].    | Лицензированный посредник продаёт его.                                     |
| They publish serialized fiction. | Они публикуют [serialized fiction].    | Они публикуют публикованную регулярными частями художественную литературу. |
| They work lawfully.              | Они работают [lawfully].               | Они работают законно.                                                      |
| They base prices on sales.       | Они [base prices on sales].            | Они основывают цены на распродажах.                                        |
| They license the music.          | Они [license the music].               | Они лицензируют музыку.                                                    |
| They use sign-up forms.          | Они имеют обыкновение [sign-up forms]. | Они используют формы с регистрацией.                                       |
| They sell per-class services.    | Они продают [per-class services].      | Они продают службы за класс.                                               |
| They offer self-paced courses.   | Они предлагают [self-paced courses].   | Они предлагают последовательности с собственным шагом.                     |
| Teacher-authors publish books.   | Teacher-authors [publish books].       | Учителя-авторы публикуют книги.                                            |
| They earn a billion.             | Они зарабатывают [a billion].          | Они зарабатывают миллиард.                                                 |

The nine requested unknown words become zero unknown words in this combined check. Every sentence above is parsed without an English remainder. Completion does not certify idiomatic Russian: “self-paced courses” still selects literal senses of both nouns, “per-class services” remains literal, and “serialized fiction” is verbose. “Sales” can still select the retail-sale sense.

### Regression checks

The same 30 website sentences were checked with `sample.mjs sentence 10` and seeds 42, 43, and 44. Completion was 4/10 → 5/10, 8/10 → 8/10, and 6/10 → 6/10. The missing-word sets did not grow. These runs include concurrent grammar edits, so the improvement is not attributed solely to this task. An isolated copy with this task's fallbacks removed reproduced the separate “pays” sense problem; the newly introduced “says top tutors” regression was fixed and has an offline grammar test. Nonidiomatic outputs outside the requested words remain visible.

`tests/formal-ai/empty-tables.test.mjs` adds 14 offline checks, with stub public APIs and User-Agent assertions: source alignment, exact reverse attestation, direct-translation preservation, passive partners/short agreement, adverbs, action nouns, spelling-aware complements, numeral magnitude/declension, hyphenated appositions, and the two grammar regressions. ESLint and the file-size check pass. Final validation: **382/382 full-suite tests pass**, including production replay with an empty cache and all 14 new offline tests. Missing public responses were recorded. The only reviewed snapshot change replaces «Не перепродавайте личных элементов данных» with «Не перепродавайте личные данные». No commit was made.
