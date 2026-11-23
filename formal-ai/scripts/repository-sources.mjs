/** Discover documentation and data prose, including files outside the Pages site. */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function discover(root, dir, pattern, recursive = true) {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(
    (error) => {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  );
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && recursive) {
        return discover(root, path, pattern);
      }
      return entry.isFile() && pattern.test(entry.name) ? [path] : [];
    })
  );
  return paths.flat().sort();
}

export async function repositorySources(root) {
  const prose = /\.(?:md|txt)$/i;
  const [top, docs, translator, research, examples, changesets, data] =
    await Promise.all([
      discover(root, '', /\.md$/i, false),
      discover(root, 'docs', prose),
      discover(root, 'formal-ai', prose, false),
      discover(root, 'formal-ai/docs', /\.(?:md|txt|json|jsonl)$/i),
      discover(root, 'examples', prose),
      discover(root, '.changeset', /\.md$/i, false),
      discover(root, 'data', /\.json$/i),
    ]);
  return [
    ...top,
    ...docs,
    ...translator,
    ...research,
    ...examples,
    ...changesets,
    ...data,
  ];
}
