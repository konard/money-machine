#!/usr/bin/env node
/**
 * Random samples of the website's own text for manual quality review.
 *
 *   node formal-ai/scripts/sample.mjs [sentence|paragraph|page|top] [count] [seed]
 *   (top: the most repeated sentence shapes, one instance each)
 *
 * Progress goes to stderr as it happens (resolve phases, every 20th live
 * request, each retry and failure), so a slow run can be told from a stuck
 * one; results go to stdout one item at a time.
 *
 * Sources: every prose field of website/strategies.json and the markdown
 * under docs/ that the site pages are built from. The same seed gives the
 * same sample, so a reviewed sample can be re-run after a fix. Each
 * sentence is read back from the Russian (src/russian/read-back.mjs) and
 * regenerated in English from its meta links: `lost`, `changed` and `added`
 * lines name information the translation did not keep, `en` an English
 * round trip that differs.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSentences, translateDocument } from '../src/document.mjs';
import { resolveText } from '../src/resolve.mjs';
import { loadLexicon } from '../src/lexicon.mjs';
import { readBack, russianFormIndex } from '../src/russian/read-back.mjs';
import { englishRoundTrip } from '../src/english/round-trip.mjs';
import { setNetworkLog } from '../src/sources/fetch.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? markdownFiles(path)
      : name.endsWith('.md')
        ? [path]
        : [];
  });
}

/** Prose strings of a strategy (skips ids, numbers, urls and names). */
function prose(value, out = []) {
  if (typeof value === 'string') {
    if (/\s/.test(value) && /[a-z]/.test(value) && !/^https?:/.test(value)) {
      out.push(value);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v) => prose(v, out));
  } else if (value && typeof value === 'object') {
    Object.entries(value)
      .filter(
        ([k]) =>
          ![
            'id',
            'sourceFile',
            'sources',
            'tags',
            'platforms',
            'businessPlan',
          ].includes(k)
      )
      .forEach(([, v]) => prose(v, out));
  }
  return out;
}

/** Pages: one per strategy and one per markdown file. */
export function pages() {
  const data = JSON.parse(
    readFileSync(join(ROOT, 'website', 'strategies.json'), 'utf8')
  );
  const strategies = Array.isArray(data) ? data : data.strategies;
  return [
    ...strategies.map((s) => ({
      source: `strategies.json#${s.id}`,
      text: prose(s).join('\n\n'),
    })),
    ...markdownFiles(join(ROOT, 'docs')).map((path) => ({
      source: relative(ROOT, path),
      text: readFileSync(path, 'utf8'),
    })),
  ].map((p) => ({ ...p, page: p.text }));
}

/** Prose paragraphs of a page (no tables, code, headings-only or link lists). */
export function paragraphs(page) {
  return page.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p &&
        !/^(\||```|#|<|---|- \[|\[)/.test(p) &&
        /[a-z]{3,} [a-z]{3,}/.test(p)
    )
    .map((text) => ({ source: page.source, page: page.text, text }));
}

export function sentences(paragraph) {
  // lines and bold labels are separate units, as in translateDocument
  const plain = paragraph.text.replace(/^\s*(?:[-*+] |\d+\. )/gm, '');
  const wrapped = !/^\s*(?:[-*+] |\d+\. |\|)/m.test(paragraph.text);
  return (wrapped ? [plain.replace(/\n/g, ' ')] : plain.split('\n'))
    .flatMap((line) => line.split(/\*\*[^*]+?:\*\*/))
    .flatMap((line) => splitSentences(line.trim()))
    .map((s) => s.trim())
    .filter((s) => s.split(' ').length >= 3)
    .map((text) => ({ source: paragraph.source, page: paragraph.page, text }));
}

/** What the Russian and the regenerated English do not keep. */
function roundTripProblems(translated, lexicon, index) {
  return translated
    .filter((s) => s.formal && s.complete)
    .flatMap((s) => {
      const r = readBack(s.text, s.formal, lexicon, index);
      const trip = englishRoundTrip(s.source, lexicon);
      return [
        ...r.links
          .filter((l) => !['kept', 'widened', 'optional'].includes(l.status))
          .map(
            (l) =>
              `${l.status} ${l.concept || l.name}${l.word ? ` (${l.word})` : ''}${l.changes ? `: ${l.changes.join('; ')}` : ''}`
          ),
        ...r.added.map((w) => `added ${w}`),
        ...(trip.exact ? [] : [`en ${trip.english}`]),
      ];
    });
}

/**
 * The most repeated sentence shapes (code spans and numbers aside), one
 * instance each: what a fix there changes on the most pages.
 */
export function frequent(units, count) {
  const shape = (t) =>
    t.replace(/`[^`]*`/g, '`X`').replace(/\d[\d.,/-]*/g, 'N');
  const groups = new Map();
  for (const u of units) {
    const g = groups.get(shape(u.text)) || { unit: u, n: 0 };
    g.n += 1;
    groups.set(shape(u.text), g);
  }
  return [...groups.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((g) => g.unit);
}

/** Deterministic shuffle (mulberry32). */
function sample(items, count, seed) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [unit = 'sentence', count = '25', seed = String(Date.now() % 100000)] =
    process.argv.slice(2);
  const all = pages();
  const field = all.map((p) => p.text).join('\n\n');
  const units =
    unit === 'page'
      ? all
      : unit === 'paragraph'
        ? all.flatMap(paragraphs)
        : all.flatMap(paragraphs).flatMap(sentences);
  let complete = 0;
  const picked =
    unit === 'top'
      ? frequent(units, Number(count))
      : sample(units, Number(count), Number(seed));
  const started = Date.now();
  const progress = (message) =>
    console.error(
      `[${((Date.now() - started) / 1000).toFixed(0).padStart(4)}s] ${message}`
    );
  setNetworkLog(({ event, url, requests, retries, failures, wait, error }) => {
    const host = new URL(url).host;
    if (event === 'request' && requests % 20 === 0) {
      progress(`network: ${requests} requests (last ${host})`);
    } else if (event === 'retry') {
      progress(
        `network: retry in ${wait / 1000}s after ${error.message} (${host}; ${retries} retries)`
      );
    } else if (event === 'failure') {
      progress(
        `network: gave up on ${url}: ${error.message} (${failures} failures)`
      );
    }
  });
  progress(`resolving ${picked.length} ${unit}s`);
  const lookup = await resolveText(picked.map((u) => u.text).join('\n\n'), {
    log: progress,
  });
  progress('resolved; translating');
  console.log(
    `resolved ${lookup.resolved.length} senses from public sources; unknown: ${lookup.missing.join(', ') || 'none'}`
  );
  const lexicon = loadLexicon();
  const index = russianFormIndex(lexicon);
  let kept = 0;
  picked.forEach((u, i) => {
    let text;
    let ok;
    const problems = [];
    try {
      const r = translateDocument(u.text, { topic: u.page, field });
      text = r.text;
      ok = r.stats.complete === r.stats.sentences;
      problems.push(...roundTripProblems(r.sentences, lexicon, index));
    } catch (error) {
      text = `CRASH: ${error.message}`;
      ok = false;
    }
    complete += ok ? 1 : 0;
    kept += ok && !problems.length ? 1 : 0;
    console.log(
      `\n[${i + 1}] ${ok ? (problems.length ? '~~' : 'ok') : '!!'} ${u.source}\nEN: ${u.text}\nRU: ${text}${problems.map((p) => `\n   ${p}`).join('')}`
    );
  });
  console.log(
    `\nseed ${seed}: ${complete}/${picked.length} ${unit}s complete, ${kept} also round-trip (of ${units.length} in the site)`
  );
}
