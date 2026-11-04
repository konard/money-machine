# Architecture invariants

These are the rules that keep a translation reproducible and the code easy
to extend. A change that breaks one of them is a defect even when the
translation it produces looks better.

## Layers

```
public APIs ─ sources/*.mjs ─ getJson (cache → fixtures → network)
        │
        ▼
lexicon (concepts, forms, frames, contexts)      data/overrides/*.lino
        │
        ▼
English analyser → meta language (links) → Russian renderer / English generator
                                         ← Russian analyser (read-back)
```

- A source module asks one public API through `getJson` with a cache
  bucket registered in `sources/registry.mjs`; a switched-off source
  answers as if it had no data.
- `compactResponse` keeps only what the readers read, so a recorded fixture
  replays to the same translation as the live response.
- Local `.lino` overrides are a union layer over public data, never a code
  branch.

## 1. A word's facts do not depend on the batch

What a word means, its Russian forms, frames and contexts are facts about
the word. They must come out the same whether the word is resolved alone
or together with 18 000 other sentences.

- The context network follows public `P279` parents only as far as the
  loader fetched them from each label (`network.horizon`). A label loaded
  for another word cannot lengthen this word's ancestry, and a depth cut
  from one label never erases parents another label fetched
  (`sources/context-data.mjs`). `closure`, `contextsOf`, the
  closure-bounded `isA` and `depth` read the graph within that horizon.
- Only Wiktionary's topical labels (`Module:labels/data/topical`,
  `sources/label-data.mjs`) make a sense field. Grammar and usage labels
  ("stative", "regional", "transitive") are not contexts.
- Tests: `context-network.test.mjs` ("contexts stay within the loaded
  horizon…", "a depth cut from one label keeps the parents…").

Evidence that depends on the text (document topic, statistical context of
the sentence, discourse referents) is computed while translating that text
and is passed explicitly; it must not be stored on concepts. Stored
per-pair evidence (such as `attachmentFrequency`, keyed by concept and
verb) is allowed because a pair's count does not depend on the text.

## 2. Every recorded response is replayed

`npm run formal-ai:record` re-records `tests/formal-ai/fixtures/public` and
`public-expected.json` from `scripts/fixture-sentences.json`. The replay test
translates every fixture sentence offline with an empty cache. A new source
request without a fixture fails offline instead of silently changing the
result.

## 3. Round trips are the check, not the reference

Each fixture sentence is also read back (Russian → meta) and generated back
to English; `scripts/sample.mjs` reports what was lost, changed, narrowed or
added. A round trip that passes with a wrong sense means the meta language
itself is wrong; only a range comparison or a reference catches that
(`meaning-context-vision.md` §7).

## Adding things

- **A data source**: a module in `sources/`, a bucket in the registry, a
  compaction rule if the response is large, and a fixture-backed test. Fetch
  only what the text needs: per word or per label, never a whole dump when a
  per-item API exists. A list that is the same for every text (such as the
  topical labels) is fetched once per process.
- **A substitution rule** (English construction → meta, meta → Russian
  form): derive it from dictionary data where the data exists (frames,
  government, labels, examples); keep it in the module of its construction;
  add a fixture sentence for the case it fixes and one for the case it must
  not touch.

## Known debt

- Five modules sit near the 1000-line limit (`resolve.mjs`,
  `english/clause.mjs`, `senses.mjs`, `russian/phrase.mjs`,
  `english/parser.mjs`); they are to be split by responsibility.
- Text helpers (`stem`, content-word sets) are duplicated with small
  differences in `topic-context.mjs`, `attachment-context.mjs`,
  `sense-context.mjs`, `sources/synonyms.mjs`, `sources/government.mjs` and
  `sources/entity-context.mjs`.
- The Russian renderer can leave a meta field unread without reporting it;
  rendering should account for every field.
- `english/clause.mjs` keeps parse state in a module variable.
- `senseDomain` falls back to a label pattern when the topical list is not
  loaded (unit tests without fixtures).
