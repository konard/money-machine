# Russian gerunds and action nouns

The renderer now prefers an attested Russian action noun, preserves its arguments,
and changes a transitive direct object to the genitive. Russian infinitive
government and the existing experiencer construction take precedence over the
noun. Reduced `while doing` clauses with a preceding subject use the same converb
path as `by doing`.

Public noun evidence comes from Wiktionary's `ru-verb` `vn=` field, derived/related
terms verified against an explicit action-noun definition, or an English -ing
noun's action/process sense. Productive -ать/-ять nominalizations only supply
lookup candidates: an explicit public derivation must confirm them. The parser
keeps the lexical noun alternative even when the action has dependents. Russian
case government includes an unambiguous possessive + instrumental noun in a
highlighted dictionary example. Recorded responses preserve that evidence.

## Changes

- `src/sources/action-nouns.mjs` and `src/resolve.mjs`: optional public pre-pass.
- `src/sources/government.mjs`, `verb-frames.mjs`, `compact.mjs`: Russian
  infinitive/instrumental evidence and replay preservation.
- `src/english/parser.mjs`: retain nominal alternatives with objects/modifiers.
- `src/russian/nonfinite.mjs`, `phrase.mjs`, `naturalize.mjs`: noun government,
  agreement, infinitive choice, and reduced while-clause converbs.
- `tests/formal-ai/action-nouns.test.mjs`, `nonfinite.test.mjs`: offline source
  fixtures and grammar checks. No runtime word-to-word exceptions were added.

## Measured examples

| English                      | Before                                 | After                       |
| ---------------------------- | -------------------------------------- | --------------------------- |
| I enjoy reading books.       | Я получаю удовольствие читать книги.   | Я наслаждаюсь чтением книг. |
| I work without tracking.     | Я работаю без того, чтобы отслеживать. | Я работаю без отслеживания. |
| I think about reading books. | Я думаю о том, чтобы читать книги.     | Я думаю о чтении книг.      |
| Reading books is fun.        | Читать книги забавно.                  | Чтение книг забавно.        |
| I work while reading books.  | Я работаю, пока читать тома.           | Я работаю, читая тома.      |

The website sentence “Advertisers pay to reach developers without tracking.”
changed from «…без того, чтобы отслеживать» to «…без отслеживания». Its existing
translation of “reach developers” is still wrong. The random sample's selling
subject and screening nominal also changed to nouns with genitive dependents.

The controlled evaluation used identical temporary source snapshots, reversing
only this task's changes for the baseline. Both consumed the same public-data
index and recorded inflection responses. API rate limiting prevented a complete
fresh live run; absent public responses were not invented. Raw Wiktionary pages
for наслаждаться, отслеживание and продажа were verified live with the required
User-Agent. Temporary stub runs disabled request pacing; runtime fetching was
unchanged.

[All 51 before/after results](gerunds-review.json) include source paths and
coverage. The 21 targeted cases (7 task examples, 14 website suffix candidates
and controls) had 11 changed outputs and unchanged completeness, 13/21. In the
30-sentence website sample (seed 20261104), 27 outputs were identical; completeness
stayed 13/30, with no newly incomplete sentences. The three changed outputs
improved noun structure or exposed a partial translation, but still contain
lexical errors. These counts measure coverage, not linguistic correctness.

## Validation and limits

- Focused nonfinite/action-noun tests: 12 passed, offline with stub fetch and
  User-Agent assertions.
- `npx eslint formal-ai tests`: passed.
- `npm run check:file-size`: passed; every JavaScript file is below 1000 lines.
- `node --test --test-timeout=60000 tests/`: 474 passed, 1 failed. The production
  replay stops at an unrecorded public name lookup for Биллинг/Фискаль/Том in
  `declineNames`; all other tests passed with local server access enabled.

The production “Selling templates takes time” example now starts «Продажа
шаблонов», but the existing contact-relative ambiguity still misparses “takes
time”. Other remaining problems include “books” → «тома», audience building,
“goods” and “courses” sense selection, and coordinated gerund subjects. The
renderer retains its existing infinitive/clausal fallback when no public noun
is available. Fronted reduced while clauses and action adverbs that require
adjectival realization on the Russian noun need further work.
