/** Grammatical frames stated in dictionary labels, definitions and examples. */
export function senseFrames(text = '') {
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
      /\b(?:with|followed by)\s+["']?(in|on|at|to|from|for|with|by|about)\b/g
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
  if (/to-infinitive|catenative|\bpermission\s*\(to\b/i.test(clean)) {
    frames.add('to');
  }
  // The bold headword in a usage example precedes its complement.
  for (const m of text.matchAll(/\{\{(?:ux|usex|co)\|en\|([^\n]+)/g)) {
    const after = m[1]
      .split(/'''[^']+'''/)
      .at(-1)
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
    if (/^\s+[^,.;|]{1,45}?\s+to\s+[a-z]+\b/i.test(after)) {
      frames.add('object-to');
    }
    if (/^\s+to\s+[a-z]+\b/i.test(after)) {
      frames.add('to');
    }
    if (/^\s+(?:whether|if|what|why|how|when|where)\b/i.test(after)) {
      frames.add('question');
    }
    if (/^\s+(?:\w+\s+)?that\b/i.test(after)) {
      frames.add('that');
    }
    if (/^\s+about\b/i.test(after)) {
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
  if (/\|(?:ambi)?transitive[|}]/.test(text)) {
    frames.add('transitive');
  }
  if (/\|(?:intransitive|ambitransitive)[|}]/.test(text)) {
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
