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
    if (arg === '--force') {
      out.force = true;
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
function worker(texts, timeout, log) {
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
    child.send({ texts, topic: texts.join('\n\n') });
  });
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
  // Bump the format version when field selection/reassembly changes.
  let version = `site-2:${await translatorHash(join(root, 'formal-ai/src'))}`;
  const memoryPath = join(output, 'memory.json');
  const savedMemory = await readJson(memoryPath);
  const memory = Object.fromEntries(
    Object.entries(savedMemory).map(([key, entry]) => [
      entry.key || key,
      { source: entry.source || key, result: entry.result },
    ])
  );
  const catalog = JSON.parse(
    await readFile(join(root, 'website/strategies.json'), 'utf8')
  );
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
    } else if (proseFields({ [key]: value }).length) {
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
    const cached = memory[sha1(`${version}\0${JSON.stringify(job.value)}`)];
    if (cached?.result.value) {
      restore(job, cached.result.value);
    }
  }
  const selected = jobs
    .filter((job) => matchesGlob(job.source, settings.only))
    .slice(0, settings.limit);
  const documents = [];
  const started = Date.now();
  for (const [i, job] of selected.entries()) {
    const documentStarted = Date.now();
    let documentVersion = version;
    const label = `[${i + 1}/${selected.length}] ${job.source}`;
    log(`${label}: starting`);
    try {
      documentVersion = `site-2:${await translatorHash(join(root, 'formal-ai/src'))}`;
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
        source: job.source,
        text,
        version: documentVersion,
        memory,
        force: settings.force,
        translate: async () => {
          const fields = job.path ? proseFields(job.value) : null;
          const results = await translate(
            fields ? fields.map((f) => f.text) : [text],
            settings.timeout,
            (phase) => log(`${label}: ${phase}`)
          );
          const sentences = results.flatMap((r) => r.sentences);
          const incomplete = sentences.filter(
            (s) =>
              !s.complete ||
              /\[[^\]]+\]/.test(s.text.replace(/\[[^\]]*\]\([^)]*\)/g, ''))
          );
          return {
            ...(results[0]?.resolutionError
              ? {
                  resolutionError: results[0].resolutionError,
                  resolutionSentence: results[0].resolutionSentence,
                }
              : {}),
            ...(fields
              ? {
                  value: reassemble(
                    job.value,
                    fields,
                    results.map((r) => r.text)
                  ),
                }
              : { text: results[0].text }),
            sentences: sentences.length,
            complete: sentences.length - incomplete.length,
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
        },
      });
      if (job.path) {
        restore(job, result.value);
        await writeJson(join(output, 'strategies.json'), translatedCatalog);
      } else {
        const target = join(output, job.source);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, result.text);
      }
      await writeJson(memoryPath, memory);
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
    await writeJson(join(output, 'report.json'), {
      version,
      uiTranslation: 'Fixed UI strings only: handwritten formal-ai/ui-ru.json',
      seconds: (Date.now() - started) / 1000,
      documents,
    });
  }
  const total = documents.reduce(
    (a, d) => ({
      sentences: a.sentences + (d.sentences || 0),
      complete: a.complete + (d.complete || 0),
      failed: a.failed + Number(Boolean(d.error)),
      resolutionWarnings:
        a.resolutionWarnings + Number(Boolean(d.resolutionError)),
    }),
    { sentences: 0, complete: 0, failed: 0, resolutionWarnings: 0 }
  );
  const report = {
    version,
    uiTranslation: 'Fixed UI strings only: handwritten formal-ai/ui-ru.json',
    seconds: (Date.now() - started) / 1000,
    ...total,
    completion: total.sentences ? total.complete / total.sentences : 0,
    documents,
  };
  await writeJson(join(output, 'strategies.json'), translatedCatalog);
  await writeJson(join(output, 'report.json'), report);
  if (translate === worker && activeWorker) {
    activeWorker.kill();
    activeWorker = null;
  }
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
  translateSite(options(process.argv.slice(2))).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
