#!/usr/bin/env node
/** Offline lexical evaluation; --ablate disables each registered method. */
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  FIXTURES,
  productionEnv,
  sentenceSet,
  BASIC,
} from './record-fixtures.mjs';

/** Rebatch recorded revision pages without inventing missing public data. */
export function fixtureFetch(root = FIXTURES) {
  const pages = new Map();
  const visit = (dir, bucket) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) {
        visit(path, bucket || item.name);
      } else if (item.name.endsWith('.json')) {
        const body = JSON.parse(readFileSync(path, 'utf8'));
        for (const page of body.query?.pages || []) {
          const key = `${bucket}:${page.title}`;
          if (!pages.has(key) || page.revisions) {
            pages.set(key, page);
          }
          for (const alias of [
            ...(body.query?.normalized || []),
            ...(body.query?.redirects || []),
          ]) {
            if (alias.to === page.title) {
              pages.set(`${bucket}:${alias.from}`, {
                ...page,
                title: alias.from,
              });
            }
          }
        }
      }
    }
  };
  visit(root);
  return (url) => {
    const u = new URL(url);
    const titles = u.searchParams.get('titles')?.split('|');
    const bucket =
      u.host === 'ru.wiktionary.org' ? 'wiktionary-ru' : 'wiktionary';
    if (!titles || titles.some((t) => !pages.has(`${bucket}:${t}`))) {
      throw Object.assign(new Error(`Unrecorded public request: ${url}`), {
        fatal: true,
        offline: true,
      });
    }
    return {
      ok: true,
      json: () => ({
        query: { pages: titles.map((t) => pages.get(`${bucket}:${t}`)) },
      }),
    };
  };
}

/** Count occurrences in the generated meaning graph, including unambiguous words. */
export function contentConcepts(value, lexicon, out = []) {
  if (!value || typeof value !== 'object') {
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    if (['concept', 'predicate'].includes(key)) {
      const c = lexicon.get(child);
      if (c?.en?.some((e) => ['noun', 'verb', 'adj', 'adv'].includes(e.pos))) {
        out.push(c);
      }
    } else if (!['senses', 'ambiguous'].includes(key)) {
      contentConcepts(child, lexicon, out);
    }
  }
  return out;
}

export async function evaluate({ ablate = false } = {}) {
  const cache = mkdtempSync(join(tmpdir(), 'formal-ai-evaluation-'));
  Object.assign(
    process.env,
    productionEnv({
      FORMAL_AI_OFFLINE: '1',
      FORMAL_AI_CACHE: cache,
      FORMAL_AI_METHODS: '',
    })
  );
  try {
    const { loadLexicon } = await import('../src/lexicon.mjs');
    const { resolveText } = await import('../src/resolve.mjs');
    const { translateDocument } = await import('../src/document.mjs');
    const { analyze } = await import('../src/english/analyze.mjs');
    const { METHODS } = await import('../src/methods.mjs');
    const { pages } = await import('./sample.mjs');
    const sources = JSON.parse(
      readFileSync(new URL('./fixture-sentences.json', import.meta.url), 'utf8')
    );
    const topics = new Map(pages().map((p) => [p.source, p.text]));
    const sentences = sentenceSet();
    const variants = ['default', ...(ablate ? Object.keys(METHODS) : [])];
    const rows = [];
    let baselineLexicon;
    let baselineMissing = [];
    for (const name of variants) {
      process.stderr.write(`evaluating ${name}\n`);
      const methods = {
        ...METHODS,
        ...(name === 'default' ? {} : { [name]: 0 }),
      };
      const needsResolution =
        !baselineLexicon || ['roundTrip', 'entityContext'].includes(name);
      let lexicon = needsResolution
        ? loadLexicon({ fresh: true })
        : baselineLexicon;
      const missing = needsResolution ? [] : [...baselineMissing];
      if (needsResolution) {
        try {
          await resolveText(sentences.join('\n\n'), { lexicon, methods });
        } catch (error) {
          if (!error.offline) {
            throw error;
          }
          missing.push(error.message);
          lexicon = loadLexicon({ fresh: true });
          await resolveText(sentences.join('\n\n'), {
            lexicon,
            methods,
            fetchImpl: fixtureFetch(),
          });
        }
      }
      if (name === 'default') {
        baselineLexicon = lexicon;
        baselineMissing = missing;
      }
      const counts = { survives: 0, anotherMeaning: 0, unknown: 0 };
      const outputs = sentences.map((english, i) => {
        const translated = translateDocument(english, {
          lexicon,
          methods,
          topic: topics.get(sources[i - BASIC.length]?.source),
        });
        for (const sentence of translated.sentences) {
          const concepts = contentConcepts(sentence.formal.statements, lexicon);
          for (const c of concepts) {
            counts[c.roundTrip?.status || 'unknown'] += 1;
          }
          const contentWords = analyze(sentence.source, lexicon).filter((t) =>
            t.readings?.some((r) =>
              ['noun', 'verb', 'adj', 'adv'].includes(r.pos)
            )
          ).length;
          counts.unknown += Math.max(
            sentence.unknown.length,
            contentWords - concepts.length
          );
        }
        return {
          english,
          russian: translated.text,
          complete: translated.stats.incomplete === 0,
        };
      });
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      rows.push({
        name,
        counts,
        total,
        rate: counts.survives / Math.max(1, total),
        missing: new Set(missing).size,
        outputs,
      });
    }
    return rows;
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
}

export function report(rows) {
  const baseline = rows[0];
  const lines = [
    '# Method evaluation',
    '',
    'Offline fixture sentences; occurrence-weighted lexical attestation, not reference translation accuracy. Survival = survives / all content occurrences; unknown evidence remains in the denominator. Same-sense English translation tables are an attestation proxy, not an independent proof of sense correctness. Source content words omitted from the meaning graph count as unknown; multiword meanings may cover multiple source words. Sentence round trip and chrF are not implemented.',
    '',
    '| Disabled method | Survives | Another meaning | Unknown | Total | Survival | Δ pp | Changed Russian | Rebatched requests |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of rows) {
    const changes = row.outputs.filter(
      (o, i) => o.russian !== baseline.outputs[i].russian
    ).length;
    lines.push(
      `| ${row.name === 'default' ? 'None (defaults)' : row.name} | ${row.counts.survives} | ${row.counts.anotherMeaning} | ${row.counts.unknown} | ${row.total} | ${(row.rate * 100).toFixed(2)}% | ${((row.rate - baseline.rate) * 100).toFixed(2)} | ${changes} | ${row.missing} |`
    );
  }
  lines.push(
    '',
    'A positive ablation delta means the enabled method lowers this metric. Defaults are retained; this harness does not silently disable methods.',
    ''
  );
  for (const row of rows.slice(1)) {
    if (row.rate > baseline.rate) {
      lines.push(
        `- **${row.name} lowers survival** by ${((row.rate - baseline.rate) * 100).toFixed(2)} percentage points.`
      );
    }
    for (const [i, output] of row.outputs.entries()) {
      if (output.russian !== baseline.outputs[i].russian) {
        lines.push(
          '',
          `- ${row.name} off — ${output.english}`,
          `  - Off: ${output.russian}`,
          `  - Default: ${baseline.outputs[i].russian}`
        );
      }
    }
  }
  const roundTrip = rows.find((row) => row.name === 'roundTrip');
  if (roundTrip) {
    const sample = roundTrip.outputs.slice(BASIC.length);
    const changed = sample.filter(
      (o, i) => o.russian !== baseline.outputs[i + BASIC.length].russian
    ).length;
    const regressed = sample.filter(
      (o, i) => o.complete && !baseline.outputs[i + BASIC.length].complete
    ).length;
    lines.push(
      '',
      `Round-trip changes ${changed}/${sample.length} seeded website sentences; ${regressed} lose completion. Lexical survival cannot establish that those changes improve sentence meaning; incomplete outputs are shown above.`
    );
  }
  lines.push(
    '',
    'documentTopic remains at 0.5. Known qualitative regressions include studies → «сообщение исследования», traffic → «торговлю», and accounts → «основания»; lexical attestation alone cannot reliably detect those sense errors.',
    '',
    'Run `npm run formal-ai:evaluate -- --ablate` to reproduce this table. The fixture set includes the seeded random website sample in fixture-sentences.json (30 sentences). Changed Russian is shown above for manual review. Missing Russian translation blocks and seed vocabulary without public sense anchors remain unknown.'
  );
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = await evaluate({ ablate: process.argv.includes('--ablate') });
  const markdown = report(rows);
  writeFileSync(
    new URL('../docs/method-evaluation.md', import.meta.url),
    markdown
  );
  console.log(markdown);
}
