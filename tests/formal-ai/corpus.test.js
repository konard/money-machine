/**
 * English → Russian sentence corpus. Every pair was checked by hand; a
 * change in output is either a fix (update the pair) or a regression.
 */

import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import {
  translateSentence,
  TranslationContext,
} from '../../formal-ai/src/translate.mjs';

export const CORPUS = [
  ['I read a book.', 'Я прочитал книгу.'],
  ['The children went to the park yesterday.', 'Дети ходили в парк вчера.'],
  ['Do you like tea?', 'Вам нравится чай?'],
  ['Where do you live?', 'Где вы живёте?'],
  ['There is a cat in the garden.', 'В саду есть кошка.'],
  ['I have two brothers.', 'У меня есть два брата.'],
  ['My brother is a doctor.', 'Мой брат — врач.'],
  ['She wants to learn Russian.', 'Она хочет изучать русский язык.'],
  ['We sat on the bank of the river.', 'Мы сидели на берегу реки.'],
  ['I opened an account at the bank.', 'Я открыл счёт в банке.'],
  ['Please open the door.', 'Пожалуйста, откройте дверь.'],
  ['Who lives here?', 'Кто живёт здесь?'],
  ["I don't know.", 'Я не знаю.'],
  ['Thank you very much!', 'Большое спасибо!'],
  [
    'If it rains, we will stay at home.',
    'Если пойдёт дождь, мы останемся дома.',
  ],
  [
    'He plays the guitar and she plays football.',
    'Он играет на гитаре, и она играет в футбол.',
  ],
  ["I don't have a car.", 'У меня нет машины.'],
  ['The house is very big.', 'Дом очень большой.'],
  ['It is cold today.', 'Сегодня холодно.'],
  ['I will read this book tomorrow.', 'Я прочитаю эту книгу завтра.'],
  ['They often go to the cinema.', 'Они часто ходят в кино.'],
  ['Can you help me?', 'Вы можете помочь мне?'],
  ['I am ready.', 'Я готов.'],
  ['What are you reading?', 'Что вы читаете?'],
  ['I gave my friend a book.', 'Я дал своему другу книгу.'],
  [
    'She lives in Moscow with her mother.',
    'Она живёт в Москве со своей матерью.',
  ],
  ['We have lived here for ten years.', 'Мы живём здесь десять лет.'],
  ['The cat is sleeping on the bed.', 'Кошка спит на кровати.'],
  ['I saw five dogs in the street.', 'Я видел пять собак на улице.'],
  ['Where are you going?', 'Куда вы идёте?'],
  ['I put the key on the table.', 'Я положил ключ на стол.'],
  ['I need some money from the bank.', 'Мне нужно немного денег из банка.'],
  ['I needed a car.', 'Мне была нужна машина.'],
  ['You need to go home.', 'Вам нужно пойти домой.'],
  ['She does not need help.', 'Ей не нужна помощь.'],
  ['Do you need a pen?', 'Вам нужна ручка?'],
  ['What are you thinking about?', 'О чём вы думаете?'],
  ['Who are you talking to?', 'С кем вы говорите?'],
  ['What are you looking at?', 'На что вы смотрите?'],
  ['I talked to my brother.', 'Я поговорил со своим братом.'],
  ['What is this?', 'Что это?'],
  ['This is my house.', 'Это мой дом.'],
  ['That is a good idea.', 'Это хорошая идея.'],
  ['That was my brother.', 'Это был мой брат.'],
  ['These are my friends.', 'Это мои друзья.'],
  ['I will come on Monday.', 'Я приду в понедельник.'],
  ['In May we met in Paris.', 'В мае мы встретились в Париже.'],
  ['On Tuesday we will go to the theatre.', 'Во вторник мы пойдём в театр.'],
  [
    'Next Friday I will visit my mother.',
    'В следующую пятницу я посещу свою мать.',
  ],
  ['Yesterday, they played football.', 'Вчера они играли в футбол.'],
  ['In the morning I drink coffee.', 'Утром я пью кофе.'],
  ['After dinner we watched a film.', 'После ужина мы посмотрели фильм.'],
  ['After we ate, we went home.', 'После того как мы ели, мы пошли домой.'],
  ['Every day I read a book.', 'Каждый день я читаю книгу.'],
  ['I saw him last week.', 'Я видел его на прошлой неделе.'],
  ['Last year we lived in Paris.', 'В прошлом году мы жили в Париже.'],
  ['This is the last page.', 'Это последняя страница.'],
  ['We will go there next summer.', 'Мы пойдём туда следующим летом.'],
  ['My name is Anna.', 'Меня зовут Анна.'],
  ["What's your name?", 'Как вас зовут?'],
  ['His name was Peter.', 'Его звали Пётр.'],
  ["It's cold today.", 'Сегодня холодно.'],
  ["John's car is red.", 'Машина Джона красная.'],
  ["Where's my key?", 'Где мой ключ?'],
  ['The mouse ate the cheese.', 'Мышь съела сыр.'],
  ['Click the mouse twice.', 'Щёлкните мышью дважды.'],
  ['I like this book too.', 'Мне тоже нравится эта книга.'],
  ['This book is too big.', 'Эта книга слишком большая.'],
  ['We met in London.', 'Мы встретились в Лондоне.'],
  ['I met my friend.', 'Я встретил своего друга.'],
  ['Put the book on the shelf.', 'Положите книгу на полку.'],
  ['Is this your car?', 'Это ваша машина?'],
  ['Click on the button.', 'Щёлкните по кнопке.'],
  ['I clicked the button.', 'Я щёлкнул по кнопке.'],
  ['Click the link.', 'Щёлкните по ссылке.'],
  // shared subject in coordinated predicates
  ['She opened the door and saw a cat.', 'Она открыла дверь и увидела кошку.'],
  [
    'We read the book and watched the film.',
    'Мы прочитали книгу и посмотрели фильм.',
  ],
  ['He works and lives in London.', 'Он работает и живёт в Лондоне.'],
  ['I put the key in the box.', 'Я положил ключ в коробку.'],
  // the theme of нравиться is the Russian subject: её, not своя
  ['She likes her job.', 'Ей нравится её работа.'],
  ['She reads the news.', 'Она читает новости.'],
  ['This tool translates documents.', 'Этот инструмент переводит документы.'],
  // a pronoun keeps its English preposition for government (talk to → с+ins)
  ['Talk to me about the weather.', 'Поговорите со мной о погоде.'],
  ['She spoke with us.', 'Она говорила с нами.'],
  ['Click the button.', 'Щёлкните по кнопке.'],
];

for (const [english, russian] of CORPUS) {
  test(`translates: ${english}`, () => {
    const result = translateSentence(english, new TranslationContext());
    assert.equal(result.text, russian);
    assert.equal(
      result.complete,
      true,
      `incomplete: ${JSON.stringify(result.notes)}`
    );
  });
}

test('polite вы is the default and --you=ty switches to ты', () => {
  assert.equal(translateDocument('Where do you live?').text, 'Где вы живёте?');
  assert.equal(
    translateDocument('Where do you live?', { you: 'ty' }).text,
    'Где ты живёшь?'
  );
  assert.equal(
    translateDocument('What is your name?', { you: 'ty' }).text,
    'Как тебя зовут?'
  );
});

test('"it" takes the gender of the thing it refers to', () => {
  assert.equal(
    translateDocument('I bought a car. It is red.').text,
    'Я купил машину. Она красная.'
  );
});

test('present/past ambiguous verbs follow the surrounding tense', () => {
  assert.equal(
    translateDocument('The cat sleeps on the bed. I read a book.').text,
    'Кошка спит на кровати. Я читаю книгу.'
  );
  assert.equal(translateDocument('I read a book.').text, 'Я прочитал книгу.');
});

test('untranslatable words stay visible in brackets and are reported', () => {
  const result = translateDocument('I like the zxqv.');
  assert.match(result.text, /\[.*zxqv.*\]/);
  assert.equal(result.stats.incomplete, 1);
});
