#!/usr/bin/env node
/** Turn cached Wiktionary batch responses into per-title records (no network). */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir, readRecord, writeRecord } from '../src/sources/fetch.mjs';
import { pagesByRequest, pageRecord } from '../src/sources/wiktionary.mjs';

for (const bucket of ['wiktionary', 'wiktionary-ru']) {
  const root = cacheDir(bucket);
  let [files, written] = [0, 0];
  for (const dir of readdirSync(root)) {
    for (const name of readdirSync(join(root, dir))) {
      const body = JSON.parse(readFileSync(join(root, dir, name), 'utf8'));
      files += 1;
      if (files % 2000 === 0) {
        console.error(`${bucket}: ${files} files, ${written} records`);
      }
      const titles = [
        ...(body.query?.pages || []).map((p) => p.title),
        ...(body.query?.normalized || []).map((x) => x.from),
        ...(body.query?.redirects || []).map((x) => x.from),
      ];
      for (const [title, page] of pagesByRequest(body, titles)) {
        if (!readRecord(bucket, title)) {
          writeRecord(bucket, title, pageRecord(title, page));
          written += 1;
        }
      }
    }
  }
  console.log(`${bucket}: ${files} files, ${written} records`);
}
