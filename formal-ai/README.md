# Formal AI translator (English → Russian)

A working copy of the JavaScript side of
[link-assistant/formal-ai](https://github.com/link-assistant/formal-ai),
changed to translate English text into Russian through Formal AI's meta
language. English is first **formalized** into links: one concept per
meaning, grounded in Wikidata where possible. The links are then
**naturalized** into Russian. Lessons from this copy are meant to go back
upstream.

## Provenance

- Upstream: `link-assistant/formal-ai` at commit `99b00e4e`, released under the
  Unlicense.
- Copied: the Links Notation parser (`src/lino.mjs`, from `js/seed_loader.js`)
  and the meta-language conventions (concept ids, `grounded-in`, ranges).
- New in this copy:
  - English morphology and parser (`src/english/`);
  - formalizer (`src/formalize.mjs`);
  - sense selection (`src/senses.mjs`);
  - Russian morphology and naturalizer (`src/russian/`);
  - document handling (`src/document.mjs`);
  - Wikidata grounding (`src/wikidata.mjs`);
  - model server and agent runner (`src/server/`, `src/with.mjs`);
  - lexicon (`data/*.lino`).

## Usage

```sh
node formal-ai/bin/formal-ai.mjs translate "We sat on the bank of the river."
node formal-ai/bin/formal-ai.mjs translate --file README.md   # a whole document
node formal-ai/bin/formal-ai.mjs formalize "I opened an account at the bank."
node formal-ai/bin/formal-ai.mjs explain "He runs the company."   # sense choices
node formal-ai/bin/formal-ai.mjs learn umbrella   # add a noun from Wikidata
node formal-ai/bin/formal-ai.mjs ground           # re-verify grounded-in ids
```

`npm run formal-ai -- <command>` does the same.

Translation entry points first resolve vocabulary from Wiktionary/Wikidata
(cached in `~/.cache/formal-ai`). Lookup progress and failures go to stderr;
translation continues if a lookup fails. Add `--offline` to `translate`,
`formalize`, `explain`, `serve`, or `with` to skip these lookups:

```sh
formal-ai translate --offline "I read a book."
formal-ai serve --offline --port 8765
formal-ai with codex --offline "Translate docs/guide.md"
```

Programmatic callers can use `startServer({ offline: true })` or
`runWith(client, prompt, { offline: true })`. A `/translate` request can
also set `options.offline: true`; a server started offline always stays offline.

The `translate` command takes these options:

- `--you ty|vy`: informal or polite "you"; the default is polite.
- `--speaker-gender f`, `--addressee-gender f`: grammatical gender for "I"
  and "you".

### With a coding agent

`serve` starts a local model server. It speaks the Anthropic Messages, OpenAI
Chat Completions and OpenAI Responses APIs, so agent CLIs can use Formal AI as
their model. `with` starts the server, points a client at it and runs the
client:

```sh
formal-ai with claude "Translate docs/guide.md"
formal-ai with codex  "Translate the second paragraph of notes.md"
formal-ai with agent  "Translate sentence 3 of notes.md into out.md"
formal-ai with claude "Translate: I read a book."
```

The model answers through the client's own tools:

1. It reads the file, using Read or `read`, or `cat` through a shell tool.
2. It translates the whole document, or the paragraph, sentence or line range
   you asked for.
3. It writes the result, using Write or `write`, `apply_patch` or a shell
   heredoc. A whole file goes to `name.ru.md` unless you name the output.
4. It reports which sentences were not fully translated.

Other options for `with`:

- `--cwd <dir>`: working directory for the client.
- `--log <file>`: write every request as JSONL.
- `--port <n>`: server port.
- `--dry-run`: print the client command instead of running it.

These versions were tested: claude 2.1.317, codex 0.166.0, agent 0.26.0.

## Meta language

Each meaning has one concept id, and each concept has one exact meaning or an
exact range of meanings:

- `bank.finance` and `bank.river`;
- `run.move`, `run.manage` and `run.execute`;
- `last` and `last.previous`.

```lino
statement
  mood declarative
  tense past
  predicate sit
  subject
    pronoun
      person 1
      number plural
  modifier
    relation rel.on
    entity
      concept bank.river
        grounded-in Q468756
```

- `grounded-in Q…`: the id was verified against Wikidata by `ground`. Labels,
  types and descriptions are checked; films, albums, taxa (for non-organisms)
  and local varieties ("… in Estonia") are rejected.
- `wikidata-exclude Q…`: records a sense that was checked and found wrong.
- Ranges: when English leaves a feature open, the formal form keeps the whole
  range, as in `tense (present past)` for "put" or `number (singular plural)`
  for "you". The naturalizer narrows the range from context and explains the
  choice in `explain`.
- `position front`: marks a fronted modifier ("In the morning, …").

### Lexicon attributes (Russian side)

- `gov:` sets the object case. `gov.<prep>:` sets it by English preposition
  ("talk to" → с+ins, "talk about" → о+prep), and `gov@<class>:` sets it by
  object class ("click the button" → по+dat, "click with the mouse" → ins).
  When the case follows the meaning, the meanings are separate concepts:
  `play.music` takes на+prep and `play.game` takes в+acc.
- `perf:`, `perf-pres:` and `perf-imp:` give the aspect partner. `hab:` gives
  the habitual motion verb, and `prefer:impf` prefers the imperfective.
- `exp-dat` marks an experiencer verb (мне нравится). `dat-pred:` marks a
  dative predicate (мне нужен). `refl-intr` marks a reciprocal reflexive (мы
  встретились). `motion` marks a verb of motion.
- Nouns can set `when:`, `at:`, `loc:`, `adj:`, `adv:` and `plt` (plurale
  tantum).

## How a word's meaning is resolved

Sense selection scores each concept by:

- its cue words, weighted by distance (`1 + 2/distance`), so the nearest
  words count most;
- the class of the verb's object (+4 if it fits, −3 if it clashes, 0 if the
  object is opaque, such as inline code);
- document memory: a sense chosen earlier in the text wins ties.

`explain` prints the scores.

Inline code, URLs, markdown links and HTML are replaced by opaque
placeholders. They pass through unchanged and still act as context: inline
code counts as the cue word "code", so "Run `npm test`" picks `run.execute`.

## Quality

- **Corpus:** `tests/formal-ai/corpus.test.js` holds about 80 sentence pairs.
  Each was reviewed by hand and is checked on every test run. A change in
  output is either a deliberate fix or a regression.
- **Grounding:** 134 concepts carry a verified `grounded-in` id; the others
  are ungrounded.
- **Bugs:** when a bug is found, its root cause is fixed in the parser,
  formalizer or naturalizer, and the sentence is added to the corpus.

Known gaps:

- The vocabulary is small, a few hundred concepts. Unknown words come out in
  `[brackets]` and are listed in the summary. `learn` adds nouns from
  Wikidata.
- Markdown link text stays in English.
- Idioms are mostly literal ("went to bed" → пошёл в кровать, not лёг спать).
- Coordinated clauses are joined with и; a contrastive а is not chosen
  ("он играет…, и она…").
- Without context, "it" defaults to the neuter оно. Across sentences, "it"
  follows the gender of its antecedent.
- Nouns whose plural equals the singular ("fish", "sheep") are read as
  singular; verb agreement does not yet narrow them to a number range.

## Tests

`node --test tests/formal-ai/` runs the following suites:

- corpus;
- morphology and sense selection;
- document structure;
- the model server, including a read → write tool loop over HTTP;
- Wikidata filters, with a stubbed API.

### Recorded production data

`node --test --test-timeout=60000 tests/formal-ai/production.test.mjs` checks
70 fixed sentences against `fixtures/public-expected.json` using production
`data/overrides`, recorded public API responses, offline mode and an empty
temporary cache. The child process isolates the production lexicon from the
hand vocabulary used by other tests. These snapshots preserve current output,
including known translation gaps; they are regression references, not reviewed
gold translations.

Run `npm run formal-ai:record` from the repository root to re-record. It uses
`~/.cache/formal-ai` (or `FORMAL_AI_CACHE`), records missing fixtures even on
warm-cache hits, verifies every live translation against an empty-cache offline
replay, then writes compact expected JSON and reports fixture size. Existing
fixtures are never overwritten. To refresh upstream data, remove
`tests/formal-ai/fixtures/public` and use an empty `FORMAL_AI_CACHE` before running
again; review changes to the expected Russian. Network requests use the generic
translator User-Agent.

The corpus has 40 basic sentences in `scripts/record-fixtures.mjs` and 30 fixed
website sentences with source paths in `scripts/fixture-sentences.json`. The
website sample was selected by sorting eligible sentences (3–14 words, ending
in punctuation, starting with a capitalized word, without Markdown, digits,
acronyms, email addresses or field delimiters) by SHA-256 of
`public-fixtures-v1:<source>:<text>`, taking 15 strategy sentences and 15 distinct
Markdown sentences. Keeping the chosen text in the repository prevents website
edits from silently changing the regression corpus. Compaction retains the
public evidence each reader consumes; tests cover dictionary senses and frames,
Russian forms and government, Wikidata entities, RNC ranks and Wikipedia counts.
