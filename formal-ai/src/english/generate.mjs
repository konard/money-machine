/** Generate English from meta links, without consulting the source sentence. */
import { loadLexicon } from '../lexicon.mjs';
import { EnglishRenderer } from './generate/render.mjs';

export function generate(formal, lexicon = loadLexicon()) {
  const renderer = new EnglishRenderer(lexicon);
  const text = renderer.statements(formal.statements || formal);
  const punctuation = formal.punctuation ?? '.';
  return (text.charAt(0).toUpperCase() + text.slice(1)).trim() + punctuation;
}

export const generateEnglish = generate;
