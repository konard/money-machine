/**
 * Cached JSON requests to public APIs (Wikidata, Wiktionary).
 *
 * Only raw API responses are cached (in `~/.cache/formal-ai/`), never a
 * hand-made word list: deleting the cache and re-running gives the same
 * translation from the live sources.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { compactResponse } from './compact.mjs';
import { bucketEnabled } from './registry.mjs';

export const USER_AGENT =
  'formal-ai-translator/0.1 (https://github.com/konard/money-machine)';

/** Cache directory, resolved on first use (not at import). */
export const cacheDir = (name) =>
  join(
    process.env.FORMAL_AI_CACHE ||
      join(
        process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
        'formal-ai'
      ),
    name
  );

const memory = new Map();

/**
 * Network progress: `setNetworkLog(fn)` reports every live request (not
 * cache or fixture hits), each retry and each failure, so a long resolve
 * shows that it is working and where it waits.
 */
let networkLog = null;
export const network = { requests: 0, retries: 0, failures: 0 };
export function setNetworkLog(fn) {
  networkLog = fn;
}

/**
 * Recorded responses: `FORMAL_AI_FIXTURES` names a directory of compact API
 * responses (read first after the cache); with `FORMAL_AI_RECORD` set, new
 * responses are written there if missing, including on cache hits; with `FORMAL_AI_OFFLINE` set, a request
 * without a recorded response fails instead of reaching the network.
 */
function fixtureFile(bucket, key) {
  const dir = process.env.FORMAL_AI_FIXTURES;
  return dir ? join(dir, bucket, key.slice(0, 2), `${key}.json`) : null;
}

function recordFixture(bucket, key, value) {
  const target = process.env.FORMAL_AI_RECORD && fixtureFile(bucket, key);
  if (target && !existsSync(target)) {
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, JSON.stringify(compactResponse(bucket, value)));
  }
}

const recordKey = (id) =>
  createHash('sha1').update(`record\n${id}`).digest('hex');

/** One stored record (a page by title), whatever batch fetched it. */
export function readRecord(bucket, id) {
  const key = recordKey(id);
  const memoryKey = `${cacheDir(bucket)}\n${process.env.FORMAL_AI_FIXTURES || ''}\n${key}`;
  if (memory.has(memoryKey)) {
    const value = memory.get(memoryKey);
    recordFixture(bucket, key, value);
    return value;
  }
  const file = join(cacheDir(bucket), key.slice(0, 2), `${key}.json`);
  const found = [file, fixtureFile(bucket, key)].find(
    (f) => f && existsSync(f)
  );
  if (!found) {
    return null;
  }
  const value = JSON.parse(readFileSync(found, 'utf8'));
  recordFixture(bucket, key, value);
  memory.set(memoryKey, value);
  return value;
}

export function writeRecord(bucket, id, value) {
  const key = recordKey(id);
  const file = join(cacheDir(bucket), key.slice(0, 2), `${key}.json`);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value));
  recordFixture(bucket, key, value);
  memory.set(
    `${cacheDir(bucket)}\n${process.env.FORMAL_AI_FIXTURES || ''}\n${key}`,
    value
  );
}

/**
 * GET (or POST with `form`) a JSON API, with an on-disk cache.
 * @param {string} url
 * @param {{form?: object, fetchImpl?: Function, cache?: boolean, bucket?: string, sources?: object}} options
 */
export async function getJson(
  url,
  {
    form,
    fetchImpl = fetch,
    cache = true,
    bucket = 'http',
    sources,
    jsonLines = false,
    transient = false,
  } = {}
) {
  if (!bucketEnabled(bucket, sources)) {
    // a switched-off source has no data (registry.mjs)
    return {};
  }
  const body = form ? new URLSearchParams(form).toString() : '';
  const key = createHash('sha1').update(`${url}\n${body}`).digest('hex');
  const memoryKey = `${cacheDir(bucket)}\n${process.env.FORMAL_AI_FIXTURES || ''}\n${key}`;
  if (cache && memory.has(memoryKey)) {
    const value = memory.get(memoryKey);
    recordFixture(bucket, key, value);
    return value;
  }
  const file = cache
    ? join(cacheDir(bucket), key.slice(0, 2), `${key}.json`)
    : null;
  if (file && existsSync(file)) {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    recordFixture(bucket, key, value);
    memory.set(memoryKey, value);
    return value;
  }
  // recorded public responses kept with the repository (tests replay them)
  const fixture = cache && fixtureFile(bucket, key);
  if (fixture && existsSync(fixture)) {
    const value = JSON.parse(readFileSync(fixture, 'utf8'));
    memory.set(memoryKey, value);
    return value;
  }
  // offline, only the network is out of reach: a stand-in fetch still runs
  if (process.env.FORMAL_AI_OFFLINE && fetchImpl === globalThis.fetch) {
    throw Object.assign(
      new Error(`offline: no recorded response for ${url} ${body}`.trim()),
      { fatal: true, offline: true }
    );
  }
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await throttle(url);
      network.requests += 1;
      networkLog?.({ event: 'request', url, attempt, ...network });
      const response = await fetchImpl(url, {
        method: form ? 'POST' : 'GET',
        headers: {
          'user-agent': USER_AGENT,
          ...(form
            ? { 'content-type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        body: form ? body : undefined,
        signal: AbortSignal.timeout(60000),
      });
      if (response.status === 429 || response.status >= 500) {
        const wait = Number(response.headers?.get?.('retry-after')) || 0;
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          wait: wait * 1000,
        });
      }
      if (!response.ok) {
        throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {
          fatal: true,
        });
      }
      const value = jsonLines
        ? (await response.text())
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
        : await response.json();
      if (file) {
        mkdirSync(join(file, '..'), { recursive: true });
        writeFileSync(file, JSON.stringify(value));
      }
      if (transient) {
        return value; // the caller stores it per record
      }
      recordFixture(bucket, key, value);
      memory.set(memoryKey, value);
      return value;
    } catch (error) {
      lastError = error;
      if (error.fatal) {
        break;
      }
      const wait = Math.max(error.wait || 0, 2000 * 2 ** attempt);
      network.retries += 1;
      networkLog?.({ event: 'retry', url, attempt, wait, error, ...network });
      await sleep(wait);
    }
  }
  network.failures += 1;
  networkLog?.({ event: 'failure', url, error: lastError, ...network });
  throw lastError;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// one request at a time per host, spaced out, as the Wikimedia API asks
const hosts = new Map();
const SPACING = 250;
async function throttle(url) {
  const host = new URL(url).host;
  const previous = hosts.get(host) || Promise.resolve();
  let release;
  const turn = new Promise((resolve) => {
    release = resolve;
  });
  hosts.set(
    host,
    previous.then(() => turn)
  );
  await previous;
  setTimeout(release, SPACING);
}

/** Run `fn` over items with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return out;
}

/** Split into chunks of `size`. */
export const chunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size)
  );
