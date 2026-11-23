/** Russian-only rendering; the English renderer retains its original markup. */
import {
  readFile,
  readdir,
  mkdir,
  rm,
  copyFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { marked } from 'marked';
import { DOC_SOURCES, LINK_RULES, layout } from './build-website.mjs';

export function languageSwitch(lang, root, path) {
  const en = lang === 'ru' ? `${root}../${path}` : `${root}${path}`;
  const ru = lang === 'ru' ? `${root}${path}` : `${root}ru/${path}`;
  return ` <span class="languages"><a href="${en}" lang="en">EN</a> | <a href="${ru}" lang="ru">RU</a></span>`;
}

/** Replace fixed UI phrases in templates, never in translated catalog data. */
export function localizeUI(source, ui) {
  const keys = Object.keys(ui).sort((a, b) => b.length - a.length);
  if (!keys.length) {
    return source;
  }
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(
    new RegExp(
      `(?<![\\w./])(?:${keys.map(escape).join('|')})(?![\\w.]|/[^<])`,
      'g'
    ),
    (key) => ui[key]
  );
}

/** Fixed UI phrases cannot match identifiers; single lowercase labels need quotes. */
export function localizeApp(source, ui) {
  const phrases = Object.fromEntries(
    Object.entries(ui).filter(([key]) => !/^[a-z]+$/.test(key))
  );
  let out = localizeUI(source, phrases);
  for (const [key, value] of Object.entries(ui).filter(([key]) =>
    /^[a-z]+$/.test(key)
  )) {
    out = out.replaceAll(`'${key}'`, `'${value}'`);
    // These single-word labels follow interpolated numbers in HTML templates.
    out = out.replaceAll(`} ${key}<`, `} ${value}<`);
  }
  return out;
}

export async function buildRussianWebsite(root) {
  const mirror = join(root, 'formal-ai/.site-ru');
  const site = join(root, 'website/ru');
  const ui = JSON.parse(
    await readFile(join(root, 'formal-ai/ui-ru.json'), 'utf8')
  );
  const catalog = JSON.parse(
    await readFile(join(mirror, 'strategies.json'), 'utf8')
  );
  const files = (
    await readdir(join(mirror, 'docs/business-plans')).catch((error) => {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    })
  ).filter((name) => name.endsWith('.md'));
  const names = new Map(catalog.strategies.map((s) => [s.id, s]));
  const missingPlans = catalog.strategies
    .filter((s) => !files.includes(`${s.id}.md`))
    .map((s) => s.id);
  // Read every input before removing the previous successful output.
  const pages = await Promise.all(
    files
      .filter((file) => file === 'README.md' || names.has(file.slice(0, -3)))
      .map(async (file) => {
        const id = file.slice(0, -3);
        return {
          path: `plans/${id === 'README' ? 'index' : id}.html`,
          md: await readFile(join(mirror, 'docs/business-plans', file), 'utf8'),
          title: names.get(id)?.name || ui['Ranked list'],
          description: names.get(id)?.summary,
          root: '../',
          rules: id === 'README' ? LINK_RULES.index : LINK_RULES.strategy,
        };
      })
  );
  const missing = [];
  for (const [src, out, title, rules, rel] of DOC_SOURCES) {
    try {
      pages.push({
        path: `docs/${out}`,
        md: await readFile(join(mirror, src), 'utf8'),
        title: ui[title] || title,
        root: rel,
        rules: LINK_RULES[rules],
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      missing.push(src);
    }
  }
  let index = await readFile(join(root, 'website/index.html'), 'utf8');
  const app = await readFile(join(root, 'website/app.js'), 'utf8');
  await rm(site, { recursive: true, force: true });
  await mkdir(site, { recursive: true });
  for (const page of pages) {
    const target = join(site, page.path);
    await mkdir(join(target, '..'), { recursive: true });
    const body = marked.parse(page.md, {
      walkTokens(token) {
        if (
          token.type !== 'link' ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(token.href)
        ) {
          return;
        }
        // Existing rules include the closing markdown parenthesis. Apply them
        // only to relative link destinations, preserving code and external URLs.
        let destination = `${token.href})`;
        for (const [from, to] of page.rules) {
          destination = destination.split(from).join(to);
        }
        token.href = destination.slice(0, -1);
      },
    });
    // Localize the shared shell before inserting translated document content.
    const marker = 'SITE_TRANSLATED_BODY';
    const shell = layout({
      title: 'SITE_DOCUMENT_TITLE',
      description: 'SITE_DOCUMENT_DESCRIPTION',
      body: marker,
      root: page.root,
      lang: 'ru',
      path: page.path,
      ui,
    });
    const escape = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    await writeFile(
      target,
      shell
        .replaceAll('SITE_DOCUMENT_TITLE', () => escape(page.title))
        .replaceAll('SITE_DOCUMENT_DESCRIPTION', () =>
          escape(page.description || page.title)
        )
        .replace(marker, () => body)
    );
  }
  index = localizeUI(index, ui).replace('<html lang="en">', '<html lang="ru">');
  index = index.replace(
    /<span class="languages"\s*>[\s\S]*?<\/span\s*>/,
    languageSwitch('ru', './', 'index.html').trim()
  );
  await writeFile(join(site, 'index.html'), index);
  await writeFile(join(site, 'app.js'), localizeApp(app, ui));
  await copyFile(join(root, 'website/styles.css'), join(site, 'styles.css'));
  await copyFile(
    join(mirror, 'strategies.json'),
    join(site, 'strategies.json')
  );
  await writeFile(
    join(site, 'build-report.json'),
    `${JSON.stringify({ pages: pages.length, missing, missingPlans, partial: missing.length > 0 || missingPlans.length > 0 || !files.includes('README.md') }, null, 2)}\n`
  );
  console.log(
    `Russian website: ${pages.length} pages; ${missing.length} supporting documents not translated yet.`
  );
}
