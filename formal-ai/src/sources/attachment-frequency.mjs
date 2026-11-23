/** Public Russian phrase/co-occurrence evidence for grammatical attachments. */
import { parseSentence } from '../english/clause.mjs';
import { attachments } from '../english/attachments.mjs';
import { declineAdjective } from '../russian/morphology.mjs';
import { translationHead } from './translation-morphology.mjs';
import { getJson, pool } from './fetch.mjs';

export async function attachmentFrequencies(text, lexicon, options = {}) {
  const queries = new Map();
  const candidates = (node) =>
    node.candidates
      .map((id) => lexicon.get(id))
      .filter((c) => /^[а-яё-]+$/i.test(translationHead(c?.ru) || ''));
  for (const sentence of text.split(/[;\n]+|(?<=[.!?])\s+/)) {
    const parsed = parseSentence(sentence, lexicon);
    if (parsed.leftover.length || parsed.unknown.length) {
      continue;
    }
    for (const { a, b, relation } of attachments(parsed.clauses)) {
      if (a.candidates.length < 2 && b.candidates.length < 2) {
        continue;
      }
      for (const ca of candidates(a)) {
        for (const cb of candidates(b)) {
          const left = translationHead(ca.ru);
          const right = translationHead(cb.ru);
          const query =
            relation === 'property'
              ? `"${declineAdjective(left, { gender: cb.ru.gender })} ${right}"`
              : `"${left}" "${right}"`;
          const targets = queries.get(query) || [];
          targets.push(
            [ca, `${relation}:a:${right}`],
            [cb, `${relation}:b:${left}`]
          );
          queries.set(query, targets);
        }
      }
    }
  }
  await pool([...queries], 3, async ([query, targets]) => {
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
    for (const [concept, key] of targets) {
      concept.attachmentFrequency ||= {};
      concept.attachmentFrequency[key] = count;
    }
  });
}
