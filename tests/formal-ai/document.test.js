/**
 * Whole-document translation: structure, code and links are preserved.
 */

import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  translateDocument,
  splitSentences,
} from '../../formal-ai/src/document.mjs';

test('sentences split without breaking abbreviations', () => {
  assert.deepEqual(splitSentences('Mr. Smith lives here. He is a doctor!'), [
    'Mr. Smith lives here.',
    'He is a doctor!',
  ]);
});

test('markdown structure, code and links survive translation', () => {
  const source = [
    '# Notes',
    '',
    'The cat sleeps on the bed. I read a book.',
    '',
    '- We live in Moscow.',
    '- I have two brothers.',
    '',
    '> My brother is a doctor.',
    '',
    '```js',
    'const cat = "The cat sleeps";',
    '```',
    '',
    'Run `npm test` and open [the book](https://example.com/book).',
    '',
  ].join('\n');
  const { text, stats } = translateDocument(source);
  const lines = text.split('\n');
  assert.equal(lines[2], 'Кошка спит на кровати. Я читаю книгу.');
  assert.equal(lines[4], '- Мы живём в Москве.');
  assert.equal(lines[5], '- У меня есть два брата.');
  assert.equal(lines[7], '> Мой брат — врач.');
  assert.deepEqual(lines.slice(9, 12), [
    '```js',
    'const cat = "The cat sleeps";',
    '```',
  ]);
  assert.match(text, /`npm test`/);
  assert.match(text, /https:\/\/example\.com\/book/);
  assert.ok(stats.sentences >= 6);
});

test('a paragraph keeps its context: "it" refers back across sentences', () => {
  assert.equal(
    translateDocument('I put the key on the table. It is in the kitchen.').text,
    'Я положил ключ на стол. Он на кухне.'
  );
});

test('repository markup translates link labels and image descriptions', () => {
  const source =
    '[The cat sleeps](https://example.com/(cat)_photo)\n\n![The cat sleeps](cat_photo.png)';
  const { text } = translateDocument(source, { markupLabels: true });
  assert.match(
    text,
    /^\[Кошка спит\]\(https:\/\/example\.com\/\(cat\)_photo\)/
  );
  assert.match(text, /!\[Кошка спит\]\(cat_photo\.png\)$/);
});

test('long fences and Markdown reference definitions survive translation', () => {
  const fenced = '````markdown\n```\nThe cat sleeps.\n```\n````';
  const definition = '[book]: https://example.com/book "The book"';
  const result = translateDocument(
    `${fenced}\n\n${definition}\nThe cat sleeps.`
  );
  assert.equal(result.text, `${fenced}\n\n${definition}\nКошка спит.`);
});

test('Markdown front matter remains valid in translated changesets', () => {
  const frontMatter = "---\n'money-machine': minor\n---";
  const source = `${frontMatter}\n\nThe cat sleeps.`;
  assert.equal(translateDocument(source).text, `${frontMatter}\n\nКошка спит.`);
});

test('a bold run-in heading with a period is read like a heading', () => {
  assert.equal(
    translateDocument('**Book.** Never buy books.').text,
    '**Книга.** Никогда не покупайте книги.'
  );
});
