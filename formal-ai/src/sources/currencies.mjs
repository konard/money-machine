/** ISO 4217 amounts: a search hit is a currency only if P498 matches. */
import { searchItems, getEntities } from '../wikidata.mjs';
import { pool } from './fetch.mjs';

export async function currencyPlans(text, options = {}) {
  const codes = new Set();
  for (const m of text.matchAll(
    /\b([A-Z]{3})\s+(?=\d)|\d[\d.,]*(?:[–-]\d[\d.,]*)?\s+([A-Z]{3})\b/g
  )) {
    codes.add(m[1] || m[2]);
  }
  const plans = [];
  await pool([...codes], 2, async (code) => {
    const ids = await searchItems(code, options);
    const entities = await getEntities(ids, options);
    const item = ids
      .map((id) => entities[id])
      .find((e) =>
        e?.claims?.P498?.some((c) => c.mainsnak?.datavalue?.value === code)
      );
    const ru = item?.labels?.ru?.value?.toLowerCase();
    if (!ru || !/^[а-яё -]+$/i.test(ru)) {
      return;
    }
    plans.push({
      lemma: code.toLowerCase(),
      pos: 'noun',
      senses: [
        {
          gloss: `A currency`,
          definition: `A currency unit (ISO 4217 ${code}).`,
          russian: [{ word: ru }],
          languages: 1,
        },
      ],
    });
  });
  return plans;
}
