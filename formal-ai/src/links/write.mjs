/** Lossless Links Notation writer for both public and local concepts. */
import { quote } from '../lino.mjs';
import { encodeValue, fieldName } from './schema.mjs';

// quote() handles token scalars; JSON's escape syntax also handles newlines.
const scalar = (value) => JSON.stringify(String(value));

/**
 * The compact en/ru lines remain readable with the existing notation. A json
 * child carries exact types and evidence not expressible in that short form.
 * Optional links annotate every property address with its owning layer.
 */
export function writeLino(concepts, { links = [] } = {}) {
  const lines = [];
  for (const concept of concepts) {
    lines.push(`concept ${scalar(concept.id)}`, '  schema links-v1');
    const annotate = (path) => {
      for (const link of links.filter(
        (l) => l.concept === concept.id && path.every((p, i) => l.path[i] === p)
      )) {
        lines.push(
          `  # ${JSON.stringify(link.path)} layer ${link.layer} (${JSON.stringify(link.provenance)})`
        );
      }
    };
    const field = (name, value, display = '') => {
      lines.push(
        `  ${name}${display ? ` ${/[\r\n]/.test(display) ? scalar(display) : display}` : ''}`,
        `    json ${scalar(encodeValue(value))}`
      );
    };
    for (const [key, value] of Object.entries(concept)) {
      if (key === 'id') {
        continue;
      }
      annotate([key]);
      if (key === 'en' && Array.isArray(value) && value.length) {
        for (const en of value) {
          field('en', en, `${en.pos} ${en.lemma || en.words?.join(' ') || ''}`);
        }
      } else if (key === 'ru' && value) {
        const { forms, ...ru } = value;
        field(
          'ru',
          Object.hasOwn(value, 'forms')
            ? { ...ru, forms: forms && typeof forms === 'object' ? {} : forms }
            : ru,
          `${ru.pos || ''} ${ru.lemma || ru.text || ''}`.trim()
        );
        if (forms) {
          for (const [slot, surface] of Object.entries(forms)) {
            field('form', surface, `${slot} ${quote(surface)}`);
          }
        }
      } else if (typeof value === 'string') {
        // Strings need no typed extension; quote the whole scalar safely.
        lines.push(`  ${fieldName(key)} ${scalar(value)}`);
      } else {
        field(fieldName(key), value);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}
