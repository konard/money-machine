/** Isolate network timeouts and synchronous parser failures from the site run. */
import { resolveText } from '../src/resolve.mjs';
import { translateDocument } from '../src/document.mjs';
import { parseSentence } from '../src/english/clause.mjs';
import { loadLexicon } from '../src/lexicon.mjs';

process.on('message', async ({ texts, topic }) => {
  try {
    process.send({ phase: 'resolve' });
    let requests = 0;
    let resolutionError;
    let resolutionSentence;
    try {
      await resolveText(topic, {
        log: (message) => process.send({ phase: String(message) }),
        ...(process.env.FORMAL_AI_OFFLINE
          ? {}
          : {
              fetchImpl: (url, options) => {
                const target = new URL(url);
                process.send({
                  phase: `network ${++requests}: ${target.hostname} ${target.searchParams.get('action') || ''}`,
                });
                return fetch(url, options);
              },
            }),
      });
    } catch (error) {
      resolutionError = error.stack || error.message;
      process.send({ phase: `lookup warning: ${error.message}` });
      // Match the resolver's corpus pre-pass boundaries to identify a parser
      // exception without changing the parser. Translation still uses the
      // document engine's sentence guards and retains bracketed leftovers.
      for (const sentence of topic.split(/\n+|(?<=[.!?])\s+/)) {
        try {
          parseSentence(sentence, loadLexicon());
        } catch {
          resolutionSentence = sentence;
          break;
        }
      }
    }
    const results = texts.map((text, i) => {
      process.send({ phase: 'translate', field: i, source: text });
      return translateDocument(text, { topic });
    });
    if (resolutionError && results.length) {
      Object.assign(results[0], { resolutionError, resolutionSentence });
    }
    process.send({ results });
  } catch (error) {
    process.send({ error: error.stack || error.message });
  }
});
