# Fact lists and reduced headline passives

## Changes

- `src/english/fact-list.mjs`: recognize parallel nominal labels with amounts, approximations, durations, and colon answers. Reuse `nominal-evidence.mjs` noun-first evidence; keep multiword instructions after colons as clauses. Prefer independently attested predicate adjectives for event-free participle labels.
- `src/english/clause.mjs`, `src/formalize.mjs`, `src/russian/fragment.mjs`, `src/russian/naturalize.mjs`: preserve fact values, separators, and answer-particle roles through rendering; extract fragment rendering to stay below the file-size limit.
- `src/english/parser.mjs`, `src/english/predicate-adjectives.mjs`: keep numbered noun labels before finite verbs; prefer a preposition followed by an NP over its unrelated noun reading; preserve postpositive adverbs after measured rates.
- `src/english/infinitive.mjs`: recognize an object-taking purpose infinitive after an adjunct even when its verb also has common noun readings, including parenthetical continuations.
- `src/english/reduced-passive.mjs`: accept a transitive reading among ambiguous senses and retain an adjunct followed by a purpose infinitive.
- `src/sources/definition-synonyms.mjs`: recover untranslated noun senses from an explicitly named bare synonym at the end of their translation gloss, using independent public dictionary translations.
- `src/senses.mjs`: currency amounts and percentages cue measured quantities without repeatedly cueing numerals/digits. This small necessary change avoids the numeric network sense defeating the financial noun sense.
- `src/russian/phrase.mjs`: a quantity of one controls singular agreement even when the source incorrectly says “1 days”.
- `tests/formal-ai/fact-lists.test.mjs`: offline fetch fixtures cover fact/imperative contrasts, answer particles, independent adjective labels, ambiguous participles, numbered adjuncts, purpose clauses, parentheses, noun/adjective/adverb readings, and missing public translations.

## Concrete before / after

Both runs use the same recorded/cached public-response inventory, including production overrides. Live API access failed; missing requests were reconstructed from already cached raw dictionary pages, and unavailable unrelated lookups returned empty responses. No invented production translations were supplied. The baseline snapshot preserves pre-existing concurrent changes and removes this task’s changes.

### Cost $0, annual $0, about 1 days, online: yes.

Before: Стойте $0, ежегодник $0, примерно 1 дни, онлайновый: поддакивайте.

After: Расходы $0, ежегодно $0, примерно 1 день, онлайновый: да.

### Setup cost about $300, annual compliance about $2,500, about 15 days, online: no, 100% foreign ownership: yes, local director required: no.

Before: Установка стоила примерно $300, ежегодное согласие, примерно 15 дней, онлайновый, внешнее владение 100%: поддакивайте, местный директор, потребованный [$2,500 no no].

After: Расходы установки примерно $300, ежегодное согласие примерно $2 500, примерно 15 дней, онлайновый: нет, внешнее владение 100%: да, местный директор необходим: нет.

### Median net at month 12 set to $40 to match the 10% profit likelihood.

Before: Медианный чистый месяц собаки [12 set to $40 to match the 10% profit likelihood].

After: Медианная прибыль в месяце 12 положена в $40, чтобы равняться вероятность прибыли 10%.

### Median net at month 12 set to $60 to match the 25% profit likelihood.

Before: Медианный чистый месяц собаки [12 set to $60 to match the 25% profit likelihood].

After: Медианная прибыль в месяце 12 положена в $60, чтобы равняться вероятность прибыли 25%.

## Why the subject was lost

The dictionary supplies noun, adjective, and adverb readings for “net”. The financial noun sense has an empty Russian translation table but explicitly names “profit” in its translation gloss. Meanwhile “at” also acquired noun readings. The adjective lookahead incorrectly treated that noun reading as the head after “net”, and the subject parser could absorb “at month” into a compound or contact relative. The numbered-label rule then refused “12” before “set”, stranding the rest of the sentence. These failures are now separated and covered by offline fixtures.

## Validation

- `node --test --test-timeout=60000 tests/`: 404 passed, 0 failed (including production replay; server tests require local loopback access).
- `npx eslint formal-ai tests`: clean.
- `npm run check:file-size`: passed; every JavaScript file remains below 1000 lines.
- Prettier run on every changed source/test file and the sample artifact.
- Deterministic website sample: 30 sentences, seed 71824, using the sampler’s selection algorithm. See `fact-lists-sample.json` for every before/after pair. 29 unchanged, 1 improved, no reviewed regressions. Completeness remains 17/30; existing unrelated incomplete translations remain incomplete. The improvement is “≈$3 в чистый месяц” → “≈$3 в месяц нетто”.

## Remaining problems

The grammatical structure is recovered, but public sense selection and Russian government still produce “прибыль … положена в $40, чтобы равняться вероятность …” instead of the desired “установлена на уровне …, чтобы соответствовать вероятности …”. The long fact list still has lexical choices such as “ежегодное согласие” and “внешнее владение”. These are reported rather than hidden by sentence-specific translations. The concurrent lexical files `translation-senses.mjs` and `lexical-gaps.mjs` were left untouched; `senses.mjs` received only the necessary generic numeric-cue change.

No commit was created.
