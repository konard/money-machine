import { DETERMINERS, POSSESSIVES } from '../english/function-words.mjs';

/** Grammatical frames stated in dictionary labels, definitions and examples. */
export function senseFrames(text = '', headword) {
  const frames = new Set();
  const clean = text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '');
  const object = '(?:someone|somebody|something|a person|an? object)';
  for (const label of text.matchAll(
    /\{\{(?:lb|label|lbl|q|qualifier)\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/g
  )) {
    const note = label[1].replace(
      /\{\{(?:m|l)\|en\|([^|}]+)(?:[^}]*)\}\}/g,
      '$1'
    );
    for (const marker of note.matchAll(
      /\b(?:with|followed by)\s+["']?(in|on|at|to|from|for|with|by|about)\b(?![- ]infinitive)/g
    )) {
      frames.add(`prep:${marker[1]}`);
    }
    if (/\bmembers? of (?:a|the) group\b/.test(note)) {
      frames.add('prep:by');
    }
  }
  if (
    new RegExp(`\\b${object}\\s+to\\s+\\w+`, 'i').test(clean) ||
    /object[^.\n]{0,20}to-infinitive/i.test(clean)
  ) {
    frames.add('object-to');
  }
  if (
    /(?:to[- ]infinitive|followed by (?:an? )?infinitive|\(to do (?:something|anything)\))/i.test(
      clean.split('\n')[0]
    )
  ) {
    frames.add('to-infinitive');
  }
  // Inspect every highlighted headword, including quotations and plain #: lines.
  for (const m of text.matchAll(/'''[^'\n]+'''(?=([^\n]*))/g)) {
    if (
      typeof headword === 'string' &&
      m[0].replace(/'/g, '').trim().toLowerCase() !== headword
    ) {
      continue;
    }
    const usage = /\{\{(?:ux|usex|co)\|en\|/.test(
      text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
    );
    const after = m[1].replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
    if (
      usage &&
      !/^\s+to\b/i.test(after) &&
      /^\s+[^,.;|]{1,45}?\s+to\s+[a-z]+\b/i.test(after)
    ) {
      frames.add('object-to');
    }
    if (/^\s+to\s+[a-z]+\b/i.test(after)) {
      frames.add('to-example');
      const target = /^\s+to\s+([a-z]+)/i.exec(after)[1].toLowerCase();
      frames.add(`to-example:${target}`);
      if (DETERMINERS[target] || POSSESSIVES[target]) {
        frames.add('prep:to');
      }
    }
    if (usage && /^\s+(?:whether|if|what|why|how|when|where)\b/i.test(after)) {
      frames.add('question');
    }
    // "He said he would be here", "The sign says it's 50 km": a clause
    // without "that" (a subject pronoun and its finite verb) is that frame
    if (
      usage &&
      (/^\s+(?:\w+\s+)?that\b/i.test(after) ||
        /^\s+(?:(?:i|he|she|we|they)\s+[a-z]+|(?:it|you)(?:['’](?:s|re|ll|d)\b|\s+(?:is|was|are|were|will|would|can|could|has|had|must|should)\b))/i.test(
          after
        ))
    ) {
      frames.add('that');
    }
    if (usage && /^\s+about\b/i.test(after)) {
      frames.add('about');
    }
  }
  if (/\b(?:whether|interrogative|question)\b/i.test(clean)) {
    frames.add('question');
  }
  if (/\bthat-clause\b/i.test(clean)) {
    frames.add('that');
  }
  if (/\babout\b/.test(clean)) {
    frames.add('about');
  }
  if (/\|(?:(?:ambi|di)?transitive|ergative)[|}]/.test(text)) {
    frames.add('transitive');
  }
  if (/\|(?:intransitive|ambitransitive|ergative)[|}]/.test(text)) {
    frames.add('intransitive');
  }
  return [...frames];
}

/** A definition includes its nested senses and examples, up to its next peer. */
export function definitionBlocks(text) {
  const lines = text.split('\n');
  return lines.flatMap((line, i) => {
    const depth = /^(#+)\s/.exec(line)?.[1].length;
    if (!depth) {
      return [];
    }
    let end = i + 1;
    while (
      end < lines.length &&
      (!/^#+\s/.test(lines[end]) || /^#+/.exec(lines[end])[0].length > depth)
    ) {
      if (/^=|^\{\{trans-/.test(lines[end])) {
        break;
      }
      end += 1;
    }
    return [
      lines
        .slice(i, end)
        .join('\n')
        .replace(/^#+\s*/, '')
        .trim(),
    ];
  });
}

/** Case labels in Russian usage notes belong to the chosen Russian lemma. */
export function russianGovernment(text = '') {
  // +obj encodes alternatives; prefer the personal controller of an infinitive.
  for (const m of text.matchAll(/\{\{\+obj\|ru\|([^{}]+)\}\}/g)) {
    for (const alternative of m[1].split('|')) {
      const controller =
        /(?:^|\s)(acc|dat|gen|ins)<(?:someone|somebody|a person)>[^|]*\binf</.exec(
          alternative
        );
      if (controller) {
        return { preposition: null, case: controller[1] };
      }
    }
    const direct = /^(acc|dat|gen|ins)</.exec(m[1]);
    if (direct) {
      return { preposition: null, case: direct[1] };
    }
  }
  const labels = [
    ...text.matchAll(/\{\{(?:lb|label|lbl|q|qualifier)\|([^{}]+)\}\}/g),
  ]
    .map((m) => m[1])
    .join(' ');
  const m =
    /(?:with|takes|\+)\s*(?:the\s+)?(?:\{\{[^}]+\}\}\s*)?(accusative|dative|genitive|instrumental)\b/i.exec(
      labels
    );
  return m
    ? {
        preposition: null,
        case: {
          accusative: 'acc',
          dative: 'dat',
          genitive: 'gen',
          instrumental: 'ins',
        }[m[1].toLowerCase()],
      }
    : undefined;
}

/** A possessive plus a feminine noun in -ой/-ей explicitly marks instrumental. */
export function exampleInstrumental(text = '') {
  return /\{\{выдел\|[^}]+\}\}\s+(?:своей|моей|твоей|нашей|вашей)\s+(?:[а-яё]+\s+){0,2}[а-яё]+(?:ой|ей)[.,|}]/i.test(
    text
      .normalize('NFD')
      .replace(/[̀́]/g, '')
      .normalize('NFC')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
  );
}
