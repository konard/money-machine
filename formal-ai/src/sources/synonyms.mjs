/** Sense-qualified synonyms can fill otherwise empty translation tables. */
const words = (s) =>
  new Set(
    (s.toLowerCase().match(/[a-z]+/g) || [])
      .filter((w) => !/^(to|a|an|the|of|or|be)$/.test(w))
      .map((w) => w.replace(/s$/, ''))
  );

export function synonymReferences(text, senses) {
  const section =
    /={4,6}Synonyms={4,6}\s*\n([\s\S]*?)(?=^={3,}|$(?![\s\S]))/m.exec(
      text
    )?.[1] || '';
  return section.split('\n').flatMap((line) => {
    const gloss = /\{\{sense\|([^{}]+)\}\}/.exec(line)?.[1];
    if (!gloss) {
      return [];
    }
    const cue = words(gloss);
    const missing = senses.find(
      (s) =>
        !s.russian.length &&
        [...cue].filter((w) => words(s.gloss).has(w)).length / cue.size >= 0.75
    );
    if (!missing) {
      return [];
    }
    const targets = [
      ...line.matchAll(/\{\{l\|en\|([^|}]+)|\[\[Thesaurus:([^\]|]+)/g),
    ].map((m) => ({
      page: m[1] || m[2],
      ...(m[2] ? { thesaurus: true } : {}),
    }));
    return targets
      .filter(({ page }) => /^[a-z]+(?: [a-z]+)*$/.test(page))
      .map((target) => ({ gloss: missing.gloss, ...target, synonym: true }));
  });
}
