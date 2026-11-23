# Russian repository content and website

Run the complete pipeline from the repository root:

```sh
npm ci
npm run formal-ai:repository
```

The pipeline builds the English catalog, translates repository prose with
Formal AI, and renders the Russian catalog and Pages site. It discovers
Markdown documentation at the root, in `.changeset/`, under `docs/`,
`formal-ai/` and `examples/`. It also discovers text documents and structured
research under `formal-ai/docs/`, and JSON under `data/`. The generated
catalog and business plans are translated along with the source documents.
Code, fixture inputs, lockfiles, and automation logs are outside the prose
inventory. Existing localized layout labels are in `formal-ai/ui-ru.json`.

The Pages workflow runs this pipeline on pull requests and pushes to `main`.
The `russian-repository` GitHub Actions artifact contains the translated
documents and data, including content outside the Pages navigation, and
`report.json`. The Pages artifact contains both English and Russian sites.
Only the build on `main` deploys them.

## Evidence and reports

A normal local run uses the translator's public dictionary sources and
`~/.cache/formal-ai` response cache. The Pages build uses repository-recorded
dictionary responses, so changes can be built without depending on the live
services. To reproduce the Pages build locally:

```sh
FORMAL_AI_OFFLINE=1 \
FORMAL_AI_SPARSE_FIXTURES=1 \
FORMAL_AI_FIXTURES=tests/formal-ai/fixtures/public \
npm run formal-ai:repository
```

The mirror is written under `formal-ai/.site-ru/` with source paths intact.
JSON keys, IDs, source URLs, enum values, and numbers are preserved. In
repository mode, reader-facing catalog names and titles are also translated.
The report counts selected jobs, units containing generated Russian,
completed units, missing offline dictionary requests, and failed documents.
An incomplete unit can still contain Russian alongside bracketed English.
Completion in this report measures available translations and parser
coverage. Independent round-trip quality is measured separately by
`node formal-ai/scripts/russian-analyser.mjs`.

Memory files under `formal-ai/.site-ru/memory/` are keyed by input, format,
translator version, and evidence mode. A repeat run can reconstruct the
mirror from memory. Failed jobs and live lookup errors are retried. The
report covers the current invocation, and filtered runs restore earlier
cached catalog entries. Each job records its translator version.

## Targeted runs

```sh
npm run build:catalog
npm run formal-ai:site -- --only 'docs/business-plans/*.md' --limit 21
npm run formal-ai:site -- --repository --only 'docs/research/**'
npm run formal-ai:site -- --force --only 'strategies.json*'
npm run website:ru
```

`--only` accepts `*`, `**` and `?`. `--limit` counts matching jobs, including
cache hits. `--timeout` sets the per-job worker limit in milliseconds.
The default is 600,000. Worker failures record the last phase and the script
continues through the remaining jobs, then exits nonzero. Output is
gitignored. A targeted run can create a partial site, documented in
`website/ru/build-report.json`.
