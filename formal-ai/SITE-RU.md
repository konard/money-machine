# Russian website mirror

Generate the English catalog first, then translate and render:

```sh
npm run build:catalog
npm run formal-ai:site
npm run website:ru
```

The translator calls `resolveText` once per document and `translateDocument`
for markdown or each selected JSON prose field. Public dictionary requests use
the translator's existing User-Agent and `~/.cache/formal-ai` cache. No prose
translations are supplied by this pipeline. The only handwritten translations
are fixed layout and app labels in `ui-ru.json`.

Output, memory, timings, incomplete sentences and errors are under
`formal-ai/.site-ru/`. Paths mirror the repository, for example
`formal-ai/.site-ru/docs/business-plans/example.md`. `strategies.json` preserves
all keys, arrays, IDs, names, URLs and numeric values; prose selection follows
the sample harness's whitespace heuristic and also includes `businessPlan`.
Single-word enum values, platform names, tags and source links stay unchanged.

```sh
npm run formal-ai:site -- --only 'docs/business-plans/*.md' --limit 21
npm run formal-ai:site -- --only 'strategies.json*'
npm run formal-ai:site -- --force --timeout 600000
SITE_LANG=ru node scripts/build-website.mjs
```

`--only` supports `*`, `**` and `?`. `--limit` counts matching documents, including
the ranked index and cached documents. `--timeout` is a per-document limit in
milliseconds (default 600000); a worker timeout records the document and last
translation field, then continues. A shared worker retains the resolved public
lexicon between documents. Sentence failures recorded by `translateDocument`
remain visible in the report, including the source sentence and bracketed
leftovers.

Lookup errors are recorded as `resolutionError` with `resolutionSentence` when
the parser exception can be reproduced. The worker still translates using the
available vocabulary and sentence guards. These partial results remain cached;
use `--force` to retry lookup warnings with unchanged translator source.

Memory entries use SHA-1 of the source text, translator source hash and pipeline
format version. Repeating a run restores outputs without dictionary
lookups; changed sources or translator code invalidate their translations.
Failed documents are retried. Reports describe the current invocation; filtered
runs preserve earlier translated JSON documents in the mirror.
The translator hash is checked before each document; a changed hash restarts
the worker. Each report entry records its `translatorVersion`.

The Russian renderer reads only the mirror and handwritten website assets,
writing `website/ru/`. A trial run can render the available pages;
`website/ru/build-report.json` identifies missing supporting documents and a
partial build. Complete the translation run before publishing the mirror:
links to documents outside a trial subset will otherwise point to missing pages.
Both output directories are gitignored.
