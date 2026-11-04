/* global structuredClone, performance */
/** Site translation selection, lossless JSON reassembly and disk memory. */
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const sha1 = (text) => createHash('sha1').update(text).digest('hex');

export async function translatorHash(dir) {
  const parts = [];
  async function walk(path, prefix = '') {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const key = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(join(path, entry.name), key);
      } else {
        parts.push(key, await readFile(join(path, entry.name), 'utf8'));
      }
    }
  }
  await walk(dir);
  return sha1(parts.join('\0'));
}

const KEEP = new Set([
  'id',
  'ids',
  'name',
  'names',
  'sourceFile',
  'sources',
  'tags',
  'platforms',
  'category',
  'tier',
  'restrictedIn',
  'countries',
]);

/** Sample harness prose selection, including nested business-plan prose. */
export function proseFields(value, path = [], out = []) {
  if (typeof value === 'string') {
    if (/\s/.test(value) && /[a-z]/.test(value) && !/^https?:/.test(value)) {
      out.push({ path, text: value });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => proseFields(v, [...path, i], out));
  } else if (value && typeof value === 'object') {
    Object.entries(value)
      .filter(([key]) => !KEEP.has(key))
      .forEach(([key, v]) => proseFields(v, [...path, key], out));
  }
  return out;
}

export function reassemble(value, fields, translations) {
  const copy = structuredClone(value);
  fields.forEach(({ path }, i) => {
    let parent = copy;
    for (const key of path.slice(0, -1)) {
      parent = parent[key];
    }
    parent[path.at(-1)] = translations[i];
  });
  return copy;
}

/** A small POSIX glob matcher: *, ** and ?. */
export function matchesGlob(path, glob = '**') {
  if (Array.isArray(glob)) {
    return glob.some((pattern) => matchesGlob(path, pattern));
  }
  let pattern = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i += 1;
      if (glob[i + 1] === '/') {
        i += 1;
        pattern += '(?:.*/)?';
      } else {
        pattern += '.*';
      }
    } else {
      pattern +=
        c === '*'
          ? '[^/]*'
          : c === '?'
            ? '[^/]'
            : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`).test(path);
}

export async function readJson(path, fallback = {}) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

/** Persist each successful document; failures are retried on the next run. */
export async function translateCached({
  source,
  text,
  version,
  memory,
  force,
  translate,
}) {
  const key = sha1(`${version}\0${text}`);
  if (!force && memory[key]) {
    return { ...memory[key].result, cached: true };
  }
  const started = performance.now();
  const result = {
    ...(await translate()),
    seconds: (performance.now() - started) / 1000,
  };
  memory[key] = { source, result };
  return { ...result, cached: false };
}
