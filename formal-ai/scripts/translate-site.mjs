#!/usr/bin/env node
/* global structuredClone, clearTimeout */
/** Translate generated-site sources; all output and translation memory stay ignored. */
import { fork } from 'node:child_process';
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  stat,
  realpath,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_SOURCES } from '../../scripts/build-website.mjs';
import { repositorySources } from './repository-sources.mjs';
import {
  matchesGlob,
  proseFields,
  reassemble,
  readJson,
  writeJson,
  translatorHash,
  translateCached,
  sha1,
} from './site-memory.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function options(argv) {
  const out = { force: false, only: '**', limit: Infinity, timeout: 600000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--force', '--repository'].includes(arg)) {
      out[arg.slice(2)] = true;
    } else if (['--only', '--limit', '--timeout'].includes(arg)) {
      const value = argv[++i];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }
      out[arg.slice(2)] = arg === '--only' ? value : Number(value);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!(out.limit >= 0) || !Number.isInteger(out.timeout) || out.timeout <= 0) {
    throw new Error(
      'Expected nonnegative --limit and positive --timeout (milliseconds)'
    );
  }
  return out;
}

let activeWorker;
let activeWorkerVersion;
function worker(texts, timeout, log, markupLabels) {
  return new Promise((resolve, reject) => {
    const child =
      activeWorker ||
      fork(fileURLToPath(new URL('./site-worker.mjs', import.meta.url)), [], {
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        execArgv: [],
      });
    activeWorker = child;
    let last = { phase: 'starting' };
    const timer = setTimeout(() => {
      finish(new Error(`Timeout after ${timeout}ms: ${JSON.stringify(last)}`));
    }, timeout);
    const finish = (error, results) => {
      clearTimeout(timer);
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      if (error) {
        child.kill();
        activeWorker = null;
        reject(error);
      } else {
        resolve(results);
      }
    };
    child.on('message', (message) => {
      if (message.results) {
        finish(null, message.results);
      } else if (message.error) {
        finish(new Error(message.error));
      } else {
        last = message;
        log(
          `${message.phase}${message.field === undefined ? '' : ` field ${message.field + 1}/${texts.length}`}`
        );
      }
    });
    child.on('error', (error) => finish(error));
    child.on('exit', (code, signal) =>
      finish(
        new Error(
          `Worker exited (${code ?? signal}); last: ${JSON.stringify(last)}`
        )
      )
    );
    child.send({ texts, topic: texts.join('\n\n'), markupLabels });
  });
}

async function translateJob({
  job,
  text,
  type,
  localizeNames,
  timeout,
  translate,
  log,
}) {
  const jsonl = type === 'jsonl';
  const value = job.path
    ? job.value
    : jsonl
      ? text
          .trim()
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line))
      : type === 'json'
        ? JSON.parse(text)
        : undefined;
  const fields =
    value === undefined ? null : proseFields(value, [], [], localizeNames);
  const inputs = fields ? fields.map((f) => f.text) : [text];
  const results = inputs.length
    ? await translate(inputs, timeout, log, localizeNames)
    : [];
  const sentences = results.flatMap((r) => r.sentences);
  const incomplete = sentences.filter(
    (s) =>
      !s.complete ||
      /\[[^\]]+\]/.test(s.text.replace(/\[[^\]]*\]\([^)]*\)/g, ''))
  );
  const translatedValue =
    fields &&
    reassemble(
      value,
      fields,
      results.map((r) => r.text)
    );
  return {
    ...(results[0]?.resolutionError
      ? {
          resolutionError: results[0].resolutionError,
          resolutionSentence: results[0].resolutionSentence,
        }
      : {}),
    ...(job.path
      ? { value: translatedValue }
      : {
          text: jsonl
            ? translatedValue.map((row) => JSON.stringify(row)).join('\n') +
              (translatedValue.length ? '\n' : '')
            : fields
              ? `${JSON.stringify(translatedValue, null, 2)}\n`
              : results[0].text,
        }),
    sentences: sentences.length,
    complete: sentences.length - incomplete.length,
    evidenceMisses: results[0]?.evidenceMisses || 0,
    translated: sentences.filter(
      (s) => s.source !== s.text && /\p{Script=Cyrillic}/u.test(s.text)
    ).length,
    review: sentences
      .map((s) => ({
        source: s.source,
        text: s.text,
        complete: s.complete,
      }))
      .sort((a, b) => sha1(a.source).localeCompare(sha1(b.source)))
      .slice(0, 30),
    incomplete: incomplete.map((s) => ({
      source: s.source,
      text: s.text,
      notes: s.notes,
    })),
  };
}

export async function translateSite({
  root = ROOT,
  translate = worker,
  log = console.log,
  ...opts
} = {}) {
  const settings = { ...options([]), ...opts };
  const output = join(root, 'formal-ai/.site-ru');
  await mkdir(output, { recursive: true });
  const mode = settings.repository ? 'repository' : 'site';
  const evidence = sha1(
    JSON.stringify([
      'site-3',
      mode,
      process.env.FORMAL_AI_OFFLINE,
      process.env.FORMAL_AI_FIXTURES,
      process.env.FORMAL_AI_FIXTURE_VERSION,
      process.env.FORMAL_AI_SPARSE_FIXTURES,
      process.env.FORMAL_AI_SOURCES,
      process.env.FORMAL_AI_DATA,
    ])
  );
  const getVersion = async () =>
    `${evidence}:${await translatorHash(join(root, 'formal-ai/src'))}:${await translatorHash(
      process.env.FORMAL_AI_DATA || join(root, 'formal-ai/data/overrides')
    ).catch((error) => {
      if (error.code === 'ENOENT') {
        return '';
      }
      throw error;
    })}`;
  const format = (job) =>
    job.path ? 'catalog' : /\.(jsonl?)$/.exec(job.source)?.[1] || 'text';
  const entryPath = (key) => join(output, 'memory', `${key}.json`);
  let version = await getVersion();
  const catalogText = await readFile(
    join(root, 'website/strategies.json'),
    'utf8'
  );
  const catalog = JSON.parse(catalogText);
  if (!Array.isArray(catalog.strategies)) {
    throw new Error(
      'Expected website/strategies.json with strategies[]; run npm run build:catalog first.'
    );
  }
  const translatedCatalog = structuredClone(catalog);
  // Short plans first give useful trial output before the large ranked index.
  const jobs = (
    await Promise.all(
      (await readdir(join(root, 'docs/business-plans')))
        .filter((name) => name.endsWith('.md'))
        .map(async (name) => ({
          source: `docs/business-plans/${name}`,
          size: (await stat(join(root, 'docs/business-plans', name))).size,
        }))
    )
  ).sort((a, b) => a.size - b.size || a.source.localeCompare(b.source));
  jobs.push(...DOC_SOURCES.map(([source]) => ({ source })));
  let catalogAlias = false;
  if (settings.repository) {
    const existing = new Set(jobs.map((job) => job.source));
    for (const source of await repositorySources(root)) {
      if (
        source === 'data/strategies.json' &&
        (await readFile(join(root, source), 'utf8')) === catalogText
      ) {
        catalogAlias = true;
      } else if (!existing.has(source)) {
        jobs.push({ source });
      }
    }
  }
  // Each strategy is one resolution document; preserve top-level metadata/shortlists too.
  for (const [key, value] of Object.entries(catalog)) {
    if (key === 'strategies') {
      value.forEach((strategy, i) =>
        jobs.push({
          source: `strategies.json#${strategy.id}`,
          value: strategy,
          path: [key, i],
        })
      );
    } else if (
      proseFields({ [key]: value }, [], [], settings.repository).length
    ) {
      jobs.push({
        source: `strategies.json#${key}`,
        value: { [key]: value },
        path: [],
      });
    }
  }
  // Restore previous JSON documents even in filtered trial runs.
  const restore = (job, value) => {
    if (job.path.length) {
      translatedCatalog[job.path[0]][job.path[1]] = value;
    } else {
      Object.assign(translatedCatalog, value);
    }
  };
  for (const job of jobs.filter((job) => job.path)) {
    const cached = await readJson(
      entryPath(
        sha1(`${version}\0${format(job)}\0${JSON.stringify(job.value)}`)
      )
    );
    if (cached.value) {
      restore(job, cached.value);
    }
  }
  const selected = jobs
    .filter((job) => matchesGlob(job.source, settings.only))
    .slice(0, settings.limit);
  const documents = [];
  const started = Date.now();
  try {
    for (const [i, job] of selected.entries()) {
      const documentStarted = Date.now();
      let documentVersion = version;
      const label = `[${i + 1}/${selected.length}] ${job.source}`;
      log(`${label}: starting`);
      try {
        documentVersion = await getVersion();
        version = documentVersion;
        if (translate === worker) {
          if (activeWorker && activeWorkerVersion !== documentVersion) {
            activeWorker.kill();
            activeWorker = null;
          }
          activeWorkerVersion = documentVersion;
        }
        const text = job.path
          ? JSON.stringify(job.value)
          : await readFile(join(root, job.source), 'utf8');
        const result = await translateCached({
          text,
          version: `${documentVersion}\0${format(job)}`,
          load: (key) => readJson(entryPath(key), null),
          save: (key, result) => {
            if (!result.resolutionError || process.env.FORMAL_AI_OFFLINE) {
              return writeJson(entryPath(key), result);
            }
          },
          force: settings.force,
          translate: () =>
            translateJob({
              job,
              text,
              type: format(job),
              localizeNames: settings.repository,
              timeout: settings.timeout,
              translate,
              log: (phase) => log(`${label}: ${phase}`),
            }),
        });
        if (job.path) {
          restore(job, result.value);
        } else {
          const target = join(output, job.source);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, result.text);
        }
        const { text: _text, value: _value, ...entry } = result;
        documents.push({
          source: job.source,
          ...entry,
          translatorVersion: documentVersion,
          translationSeconds: entry.seconds,
          seconds: (Date.now() - documentStarted) / 1000,
        });
        log(
          `${label}: ${result.cached ? 'cached' : `${result.seconds.toFixed(2)}s`} ${result.complete}/${result.sentences} complete`
        );
      } catch (error) {
        documents.push({
          source: job.source,
          error: error.message,
          translatorVersion: documentVersion,
          seconds: (Date.now() - documentStarted) / 1000,
        });
        log(`${label}: FAILED ${error.message}`);
      }
    }
  } finally {
    if (translate === worker && activeWorker) {
      activeWorker.kill();
      activeWorker = null;
    }
  }
  const total = documents.reduce(
    (a, d) => ({
      sentences: a.sentences + (d.sentences || 0),
      complete: a.complete + (d.complete || 0),
      translated: a.translated + (d.translated || 0),
      evidenceMisses: a.evidenceMisses + (d.evidenceMisses || 0),
      failed: a.failed + Number(Boolean(d.error)),
      resolutionWarnings:
        a.resolutionWarnings + Number(Boolean(d.resolutionError)),
    }),
    {
      sentences: 0,
      complete: 0,
      translated: 0,
      evidenceMisses: 0,
      failed: 0,
      resolutionWarnings: 0,
    }
  );
  const report = {
    version,
    scope: mode,
    selected: selected.length,
    available: jobs.length,
    uiTranslation: 'Fixed UI strings only: handwritten formal-ai/ui-ru.json',
    seconds: (Date.now() - started) / 1000,
    ...total,
    completion: total.sentences ? total.complete / total.sentences : 0,
    documents,
  };
  await writeJson(join(output, 'strategies.json'), translatedCatalog);
  if (catalogAlias && selected.length === jobs.length && !total.failed) {
    await writeJson(join(output, 'data/strategies.json'), translatedCatalog);
  }
  await writeJson(join(output, 'report.json'), report);
  log(
    `Overall: ${total.complete}/${total.sentences} sentences complete (${(report.completion * 100).toFixed(1)}%); ${total.failed} failed documents; ${total.resolutionWarnings} lookup warnings; ${report.seconds.toFixed(2)}s`
  );
  return report;
}

if (
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => null)) ===
    fileURLToPath(import.meta.url)
) {
  translateSite(options(process.argv.slice(2)))
    .then((report) => {
      if (
        report.failed ||
        (report.selected === report.available && !report.translated)
      ) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
