/** Attested Russian names for actions; endings select candidates, never invent them. */
import { readings, tokenize } from '../english/analyze.mjs';
import { regularEntry } from '../russian-entry.mjs';
import {
  fetchPages,
  languageSection,
  russianTemplates,
  unstress,
} from './wiktionary.mjs';
import { governmentPages, verbGovernment } from './government.mjs';

const links = (text) =>
  [
    ...unstress(text).matchAll(
      /\[\[([а-яё-]+)(?:\|[^\]]+)?\]\]|\{\{[lm]\|ru\|([а-яё-]+)/gi
    ),
  ].map((m) => unstress(m[1] || m[2]));

/** Both Wiktionaries identify the source verb explicitly in a noun definition. */
export function actionNounOf(page = '', lemma) {
  const section = unstress(
    languageSection(page, 'Russian') ||
      page.split(/=\s*\{\{-ru-\}\}\s*=/)[1] ||
      ''
  );
  return section
    .split('\n')
    .some(
      (line) =>
        /^#/.test(line) &&
        /verbal noun|action noun|отглагольн|отгл[ .-]*(?:сущ|существ)|действи[ея].{0,30}(?:глагол|по значению)|\{\{действие\|/i.test(
          line
        ) &&
        (links(line).includes(lemma) ||
          line.includes(`|${lemma}|`) ||
          line.includes(`|${lemma}}}`))
    );
}

/** Only request action vocabulary when the text actually has an -ing verb. */
export async function learnActionNouns(text, lexicon, options) {
  const tokens = tokenize(text);
  const verbs = tokens
    .flatMap((t) => readings(t, lexicon))
    .filter((r) => r.pos === 'verb');
  const actions = verbs.filter((r) => r.features?.form === 'ing');
  if (!actions.length) {
    return;
  }
  const entries = [...new Set(verbs.flatMap((r) => r.concepts || []))]
    .map((id) => lexicon.get(id))
    .filter((c) => c?.ru?.pos === 'verb');
  const lemmas = entries.map((c) => c.ru.lemma).filter((w) => !w.includes(' '));
  const pages = await fetchPages(lemmas, options).catch(() => new Map());
  const russian = await governmentPages(lemmas, options);
  for (const c of entries) {
    Object.assign(
      c.ru,
      verbGovernment(pages.get(c.ru.lemma), russian.get(c.ru.lemma), {
        lemma: c.en?.[0]?.lemma,
        gloss: c.gloss,
        definition: c.definition,
        frames: c.frames,
      })
    );
  }
  const targets = [...new Set(actions.flatMap((r) => r.concepts || []))]
    .map((id) => lexicon.get(id)?.ru)
    .filter((ru) => ru?.pos === 'verb' && !ru.actionNoun);
  const candidates = new Map(
    targets.map((ru) => {
      const en = languageSection(pages.get(ru.lemma) || '', 'Russian');
      const vn = russianTemplates(pages.get(ru.lemma) || '').find(
        (e) => e.pos === 'verb'
      )?.headword?.named?.vn;
      if (vn) {
        const word = unstress(vn).split(/[,/]/)[0].trim();
        ru.actionNoun = regularEntry('noun', { word });
        if (ru.actionNoun) {
          return [ru, []];
        }
      }
      const local =
        (russian.get(ru.lemma) || '').split(/=\s*\{\{-ru-\}\}\s*=/)[1] || '';
      // any heading ends the section, also the bare `=` of a compacted page
      const derived = [
        ...`${en}\n${local}`.matchAll(
          /^={3,5}\s*(?:Derived terms|Related terms|Производные слова|Родственные слова)\s*={3,5}\s*\n([\s\S]*?)(?=^=|$(?![\s\S]))/gm
        ),
      ]
        .map((m) => m[1])
        .join('\n');
      const templateWords = [
        ...unstress(derived).matchAll(/(?:[|=])([а-яё-]+)(?=[|}])/g),
      ].map((m) => m[1]);
      const regular = /[ая]ть$/.test(ru.lemma)
        ? ru.lemma.replace(/ть$/, 'ние')
        : null;
      return [
        ru,
        [
          ...new Set(
            [...links(derived), ...templateWords, regular].filter(Boolean)
          ),
        ].filter((w) => w !== ru.lemma),
      ];
    })
  );
  const titles = [...new Set([...candidates.values()].flat())];
  const nounPages = await fetchPages(titles, options).catch(() => new Map());
  const localNouns = await governmentPages(titles, options);
  for (const [ru, words] of candidates) {
    const word = words.find(
      (w) =>
        actionNounOf(nounPages.get(w), ru.lemma) ||
        actionNounOf(localNouns.get(w), ru.lemma)
    );
    if (word) {
      ru.actionNoun = regularEntry('noun', { word });
    }
  }
}
