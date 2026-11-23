/** Snapshot existing public Wiktionary responses by title; never use the network.
 * node formal-ai/docs/site-audit/build-index.mjs [cache-bucket] [output.json]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [
  directory = join(homedir(), '.cache/formal-ai/wiktionary'),
  output = '/tmp/site-audit/pages.json',
] = process.argv.slice(2);
const pages = new Map();
for (const subdirectory of readdirSync(directory)) {
  for (const file of readdirSync(join(directory, subdirectory))) {
    const body = JSON.parse(
      readFileSync(join(directory, subdirectory, file), 'utf8')
    );
    for (const page of body.query?.pages || []) {
      if (!page.revisions) {
        continue;
      }
      pages.set(page.title, page);
      for (const alias of [
        ...(body.query.redirects || []),
        ...(body.query.normalized || []),
      ]) {
        if (alias.to === page.title) {
          pages.set(alias.from, { ...page, title: alias.from });
        }
      }
    }
  }
}
writeFileSync(output, JSON.stringify(Object.fromEntries(pages)));
process.stdout.write(`${pages.size} public pages indexed\n`);
