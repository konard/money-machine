/** Public corpus evidence for a verb and its grammatical object. */
import { parseSentence } from '../english/clause.mjs';
import { getJson, pool } from './fetch.mjs';

export async function contextFrequencies(text, lexicon, options = {}) {
  const pairs = new Map();
  function visit(clause) {
    const verb = clause?.verb;
    const object = clause?.passive ? clause.subject : clause?.objects?.[0];
    if (verb?.candidates?.length > 1 && object?.head && !object.name) {
      const nouns = object.head.candidates
        .map((id) => lexicon.get(id))
        .filter((c) => c?.ru?.pos === 'noun' && /^[а-яё-]+$/i.test(c.ru.lemma));
      for (const id of verb.candidates) {
        const c = lexicon.get(id);
        if (!c?.ru || !/^[а-яё-]+$/i.test(c.ru.lemma)) {
          continue;
        }
        for (const noun of nouns.slice(0, 2)) {
          const query = `"${c.ru.lemma}" "${noun.ru.lemma}"`;
          const targets = pairs.get(query) || [];
          targets.push({ c, noun: noun.ru.lemma });
          pairs.set(query, targets);
        }
      }
    }
    if (clause?.xcomp) {
      visit(clause.xcomp);
    }
  }
  for (const sentence of text.split(/\n+|(?<=[.!?])\s+/)) {
    const parsed = parseSentence(sentence, lexicon);
    if (!parsed.leftover.length && !parsed.unknown.length) {
      parsed.clauses.forEach(visit);
    }
  }
  await pool([...pairs], 3, async ([query, targets]) => {
    const body = await getJson(
      `https://ru.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query',
        list: 'search',
        format: 'json',
        srlimit: '1',
        srinfo: 'totalhits',
        srprop: '',
        srsearch: query,
      })}`,
      { ...options, bucket: 'ruwiki-context' }
    ).catch(() => null);
    const count = body?.query?.searchinfo?.totalhits;
    if (!Number.isFinite(count)) {
      return;
    }
    for (const { c, noun } of targets) {
      c.objectFrequency ||= {};
      c.objectFrequency[noun] = count;
    }
  });
}
