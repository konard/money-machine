#!/usr/bin/env node
/**
 * node formal-ai/scripts/generalization.mjs [count=100] [seed=20261104]
 *   [output.json] [--input=snapshot.json] [--pages=40]
 * Raw public responses use getJson's cache; --input replays the exact sample.
 * The search endpoint caps results: this is a sample of the fetched pool,
 * not a uniform sample of the entire Tatoeba corpus. No reference is used
 * in resolution, translation, or error detection.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getJson } from '../src/sources/fetch.mjs';
import { resolveText } from '../src/resolve.mjs';
import { translateDocument } from '../src/document.mjs';

export function sample(items, count, seed) {
  let state = seed >>> 0;
  const copy = [...items];
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** chrF2: orders 1–6, beta=2, case sensitive, Unicode, no whitespace.
 * Average precision/recall over orders present in BOTH strings, then F2.
 * Scores are 0–100; sentence scores take the best complete reference.
 */
export function chrf(hypothesis, reference) {
  const chars = (s) => [...s.normalize('NFC').replace(/\s/gu, '')];
  const h = chars(hypothesis);
  const r = chars(reference);
  if (!h.length || !r.length) {
    return h.length === r.length ? 100 : 0;
  }
  const grams = (s, n) => {
    const out = new Map();
    for (let i = 0; i <= s.length - n; i += 1) {
      const key = s.slice(i, i + n).join('');
      out.set(key, (out.get(key) || 0) + 1);
    }
    return out;
  };
  let precision = 0;
  let recall = 0;
  const orders = Math.min(6, h.length, r.length);
  for (let n = 1; n <= orders; n += 1) {
    const hg = grams(h, n);
    const rg = grams(r, n);
    let matches = 0;
    for (const [key, count] of hg) {
      matches += Math.min(count, rg.get(key) || 0);
    }
    precision += matches / (h.length - n + 1);
    recall += matches / (r.length - n + 1);
  }
  precision /= orders;
  recall /= orders;
  return precision + recall
    ? (500 * precision * recall) / (4 * precision + recall)
    : 0;
}

export function failureClasses(result) {
  const classes = [];
  if (/[[\]]/.test(result.text)) {
    classes.push('parse failure');
  }
  const unknown = result.sentences?.flatMap((s) => s.unknown || []) || [];
  // A Latin token is a candidate, not proof: names can legitimately remain.
  if (
    unknown.length ||
    /\b[a-z]{2,}\b/.test(result.text.replace(/\[[^\]]*\]/g, ''))
  ) {
    classes.push('lexical gap candidate');
  }
  if (
    result.sentences?.some((s) =>
      s.notes?.some((n) => /internal error/.test(n))
    )
  ) {
    classes.push('internal error');
  }
  return classes;
}

/** Direct links only: translations[1] are indirect via another language. */
export function eligibleSentences(body) {
  return (body.results || []).flatMap((s) => {
    const words = s.text?.match(/\p{L}+(?:['’-]\p{L}+)*/gu) || [];
    const refs = (s.translations?.[0] || []).filter((r) => r.lang === 'rus');
    return s.lang === 'eng' &&
      words.length >= 4 &&
      words.length <= 20 &&
      refs.length
      ? [
          {
            id: s.id,
            text: s.text,
            references: refs.map((r) => ({ id: r.id, text: r.text })),
            license: s.license,
            author: s.user?.username || null,
          },
        ]
      : [];
  });
}

export async function fetchPool({
  pages = 40,
  fetchImpl,
  cache = true,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
} = {}) {
  const found = new Map();
  const urls = [];
  for (let page = 1; page <= pages; page += 1) {
    const url = `https://tatoeba.org/en/api_v0/search?${new URLSearchParams({ from: 'eng', to: 'rus', query: '', sort: 'created', page: String(page) })}`;
    const body = await getJson(url, { fetchImpl, cache, bucket: 'tatoeba' });
    if (!Array.isArray(body.results)) {
      throw new Error('Invalid Tatoeba response (expected results array)');
    }
    urls.push(url);
    eligibleSentences(body).forEach((s) => found.set(s.id, s));
    log(`Tatoeba page ${page}: ${found.size} eligible direct pairs`);
    if (!body.paging?.Sentences?.nextPage || !body.results.length) {
      break;
    }
    // Deliberately sequential, at most one search per second, plus getJson
    // throttling/retries (including Retry-After on HTTP 429).
    if (page < pages) {
      await pause(1000);
    }
  }
  return { urls, sentences: [...found.values()] };
}

export async function evaluate(
  sentences,
  { resolve = resolveText, translate = translateDocument, log = () => {} } = {}
) {
  await resolve(sentences.map((s) => s.text).join('\n\n'), { log });
  const results = sentences.map((s) => {
    const result = translate(s.text);
    return {
      ...s,
      ours: result.text,
      chrf: Math.max(...s.references.map((r) => chrf(result.text, r.text))),
      complete: !/[[\]]/.test(result.text),
      classes: failureClasses(result),
      diagnostics: result.sentences.map(({ unknown, leftover, notes }) => ({
        unknown,
        leftover,
        notes,
      })),
    };
  });
  return {
    count: results.length,
    meanChrf: results.reduce((sum, r) => sum + r.chrf, 0) / results.length,
    completePercent:
      (100 * results.filter((r) => r.complete).length) / results.length,
    results,
    worst25: [...results]
      .sort((a, b) => a.chrf - b.chrf || a.id - b.id)
      .slice(0, 25),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const [countArg = '100', seedArg = '20261104', output] = positional;
  const count = Number(countArg);
  const seed = Number(seedArg);
  const pages = Number(
    args.find((a) => a.startsWith('--pages='))?.slice(8) || 40
  );
  if (
    ![count, pages].every((n) => Number.isInteger(n) && n > 0) ||
    !Number.isInteger(seed)
  ) {
    throw new Error(
      'count/pages must be positive integers; seed must be an integer'
    );
  }
  const input = args.find((a) => a.startsWith('--input='))?.slice(8);
  const log = (s) => process.stderr.write(`${s}\n`);
  const pool = input
    ? JSON.parse(readFileSync(input, 'utf8'))
    : await fetchPool({ pages, log });
  if (input && pool.seed !== undefined && pool.seed !== seed) {
    throw new Error(
      `Snapshot seed ${pool.seed} differs from requested ${seed}`
    );
  }
  const picked = input
    ? (pool.sample || pool.results).map(
        ({ id, text, references, refs, license, author }) => ({
          id,
          text,
          references:
            references ||
            Object.entries(refs).map(([id, text]) => ({
              id: Number(id),
              text,
            })),
          license,
          author,
        })
      )
    : sample(pool.sentences, count, seed);
  if (picked.length !== count) {
    throw new Error(
      `Requested ${count}, have ${picked.length}; increase --pages or match snapshot count`
    );
  }
  const report = {
    seed,
    source: 'Tatoeba api_v0; direct EN–RU links; 4–20 words',
    fetchedAt: pool.fetchedAt || new Date().toISOString(),
    poolSize: pool.poolSize || pool.sentences?.length,
    urls: pool.urls,
    metric:
      'sentence chrF2, orders 1–6, case sensitive, whitespace removed, effective orders; max over references; macro mean',
    ...(await evaluate(picked, { log })),
  };
  if (output) {
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(
    `seed ${seed}, N=${report.count}: chrF ${report.meanChrf.toFixed(3)}; complete ${report.completePercent.toFixed(1)}%`
  );
  report.worst25.forEach((r) =>
    console.log(
      `\n#${r.id} chrF ${r.chrf.toFixed(2)} [${r.classes.join(', ')}]\nEN: ${r.text}\nREF: ${r.references.map((ref) => ref.text).join(' / ')}\nOURS: ${r.ours}`
    )
  );
}
