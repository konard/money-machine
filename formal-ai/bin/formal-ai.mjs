#!/usr/bin/env node
/**
 * formal-ai: English → Russian translation through Formal AI's meta language.
 *
 *   formal-ai translate "I read a book."         translate text (sentence,
 *   formal-ai translate --file README.md          paragraph or document)
 *   formal-ai formalize "We sat on the bank."     show the meta-language links
 *   formal-ai parse-ru "Я читаю книгу."          analyse Russian; --roundtrip compares links
 *   formal-ai roundtrip "I read a book."          regenerate English + compare links
 *   formal-ai explain "We sat on the bank."       show sense choices + notes
 *   formal-ai serve [--port 8765]                 OpenAI/Anthropic-compatible
 *   formal-ai with claude|codex|agent "…"         run a coding agent on it
 *   formal-ai learn <english-noun>                fetch a noun from Wikidata
 *   formal-ai ground                              verify concept groundings
 *   --offline                                    skip translation lookups
 *   --context commerce                           set an explicit context
 *   --options 5                                  show coherent context readings
 *   --methods documentTopic=0.5,roundTrip=off    weight or turn off a method
 *   --sources tatoeba=off,ru.wikipedia=off       turn off a public source
 *   formal-ai links <word>                       inspect merged source links
 *   formal-ai sources                             list the public sources
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { translateDocument, splitSentences } from '../src/document.mjs';
import { formalize, toLino } from '../src/formalize.mjs';
import { loadLexicon } from '../src/lexicon.mjs';
import { DocumentMemory } from '../src/senses.mjs';
import { topicProfile } from '../src/topic-context.mjs';
import { parseMethods } from '../src/methods.mjs';
import {
  SOURCES,
  configureSources,
  parseSources,
} from '../src/sources/registry.mjs';
import { resolveForTranslation } from '../src/translate.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=');
      if (inline !== undefined) {
        args[key] = inline;
      } else if (key === 'offline' || key === 'roundtrip') {
        args[key] = true;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function readInput(args) {
  if (args.file) {
    return readFileSync(args.file, 'utf8');
  }
  if (args._.length) {
    return args._.join(' ');
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const options = (args) => ({
  context: args.context,
  options: args.options ? Number(args.options) : undefined,
  offline: Boolean(args.offline),
  you: args.you === 'ty' ? 'ty' : 'vy',
  speakerGender: args['speaker-gender'] === 'f' ? 'f' : 'm',
  addresseeGender: args['addressee-gender'] === 'f' ? 'f' : 'm',
  ...(args.methods ? { methods: parseMethods(String(args.methods)) } : {}),
  ...(args.sources ? { sources: parseSources(String(args.sources)) } : {}),
});

const HELP = readFileSync(new URL(import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l.startsWith(' * ') || l === ' *')
  .map((l) => l.slice(3))
  .join('\n');

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (args.sources) {
    configureSources(parseSources(String(args.sources)));
  }
  switch (command) {
    case 'parse-ru': {
      const text = await readInput(args);
      const lexicon = loadLexicon();
      const { analyzeRussian, russianRoundTrip } =
        await import('../src/russian/analyze/index.mjs');
      const result = args.roundtrip
        ? russianRoundTrip(text, lexicon)
        : analyzeRussian(text, lexicon);
      const formal = args.roundtrip ? result.before : result;
      if (args.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write(
          `# ${text}\n${toLino(formal.statements, lexicon)}\n`
        );
        if (args.roundtrip) {
          process.stdout.write(
            `${result.russian}\n${result.exact ? 'Exact meta links.' : JSON.stringify(result.differences, null, 2)}\n`
          );
        }
        if (formal.leftover.length || (args.roundtrip && !result.complete)) {
          process.stdout.write(
            `# incomplete parse: ${JSON.stringify(formal.leftover)}\n`
          );
        }
      }
      return;
    }
    case 'links': {
      const word = (await readInput(args)).trim();
      const lexicon = loadLexicon();
      const { resolveText } = await import('../src/resolve.mjs');
      const { loadSourceLinks } =
        await import('../src/sources/link-adapters.mjs');
      const { linksConcept } = await import('../src/links/schema.mjs');
      const { writeLino } = await import('../src/links/write.mjs');
      if (!args.offline) {
        const lookup = { ...options(args), lexicon, log: console.error };
        try {
          await resolveText('', { ...lookup, words: [word] });
        } catch (error) {
          console.error(`public vocabulary: ${error.message}`);
          await loadSourceLinks(word, lexicon, lookup);
        }
      }
      const links = lexicon.mergedLinks(word);
      const ids = [...new Set(links.map((link) => link.concept))];
      process.stdout.write(
        writeLino(
          ids.map((id) =>
            linksConcept(
              id,
              links.filter((link) => link.concept === id)
            )
          ),
          { links }
        )
      );
      break;
    }
    case 'sources': {
      for (const [name, s] of Object.entries(SOURCES)) {
        console.log(
          `${name}\t${s.status || 'in use'}\t${s.license}\t${s.provides}`
        );
      }
      break;
    }
    case 'translate': {
      const text = await readInput(args);
      await resolveForTranslation(text, options(args));
      const result = translateDocument(text, { ...options(args), topic: text });
      if (args.json) {
        process.stdout.write(
          `${JSON.stringify({ text: result.text, stats: result.stats, sentences: result.sentences.map(summary), options: result.options }, null, 2)}\n`
        );
      } else {
        const output = result.options
          ? result.options.map((o) => `[${o.context}] ${o.text}`).join('\n')
          : result.text;
        if (args.out) {
          writeFileSync(args.out, `${output}\n`);
        } else {
          process.stdout.write(`${output}\n`);
        }
        if (args.report || result.stats.incomplete) {
          process.stderr.write(`${report(result)}\n`);
        }
      }
      process.exitCode = result.stats.incomplete && args.strict ? 2 : 0;
      return;
    }
    case 'roundtrip': {
      const text = await readInput(args);
      await resolveForTranslation(text, options(args));
      const { englishRoundTrip } =
        await import('../src/english/round-trip.mjs');
      const lexicon = loadLexicon();
      for (const sentence of splitSentences(text.replace(/\s+/g, ' '))) {
        const result = englishRoundTrip(sentence, lexicon, {
          memory: {
            methods: options(args).methods,
            explicitContext: args.context,
          },
        });
        if (args.json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          process.stdout.write(`${result.english}\n`);
          process.stdout.write(
            result.exact
              ? 'Exact meta links.\n'
              : `${JSON.stringify(result.differences, null, 2)}\n`
          );
          if (!result.complete) {
            process.stdout.write(
              `Incomplete parse: ${JSON.stringify({ before: { unknown: result.before.unknown, leftover: result.before.leftover }, after: { unknown: result.after.unknown, leftover: result.after.leftover } })}\n`
            );
          }
        }
      }
      return;
    }
    case 'formalize':
    case 'explain': {
      const text = await readInput(args);
      await resolveForTranslation(text, options(args));
      const lexicon = loadLexicon();
      const memory = new DocumentMemory();
      memory.methods = options(args).methods;
      memory.explicitContext = args.context;
      memory.setTopic(text);
      memory.profile = topicProfile(text, lexicon);
      for (const sentence of splitSentences(text.replace(/\s+/g, ' '))) {
        const formal = formalize(sentence, lexicon, memory);
        process.stdout.write(
          `# ${sentence}\n${toLino(formal.statements, lexicon)}\n`
        );
        if (command === 'explain') {
          for (const s of formal.senses) {
            process.stdout.write(
              `# sense "${s.word}" → ${s.chosen}${s.ambiguous ? ' (tie)' : ''} ${JSON.stringify(s.scores)}\n#   ${s.evidence.join('\n#   ') || 'no evidence: first listed sense'}\n`
            );
          }
          if (formal.unknown.length || formal.leftover.length) {
            process.stdout.write(
              `# unknown: ${formal.unknown.join(', ') || '-'}; unparsed: ${formal.leftover.join(' ') || '-'}\n`
            );
          }
        }
        process.stdout.write('\n');
      }
      return;
    }
    case 'serve': {
      const { startServer } = await import('../src/server/server.mjs');
      const server = await startServer({
        port: Number(args.port || 8765),
        host: args.host || '127.0.0.1',
        options: options(args),
      });
      process.stdout.write(`formal-ai listening on ${server.url}\n`);
      return;
    }
    case 'with': {
      const { runWith } = await import('../src/with.mjs');
      const [client, ...prompt] = args._;
      process.exitCode = await runWith(client, prompt.join(' '), {
        ...args,
        options: options(args),
      });
      return;
    }
    case 'learn': {
      const { learnNoun } = await import('../src/wikidata.mjs');
      for (const word of args._) {
        process.stdout.write(
          `${await learnNoun(word, { dryRun: Boolean(args['dry-run']) })}\n`
        );
      }
      return;
    }
    case 'ground': {
      const { groundLexicon } = await import('../src/wikidata.mjs');
      process.stdout.write(
        `${await groundLexicon({ write: Boolean(args.write), limit: Number(args.limit || 0) })}\n`
      );
      return;
    }
    default:
      process.stdout.write(`${HELP}\n`);
  }
}

function summary(s) {
  return {
    source: s.source,
    text: s.text,
    complete: s.complete,
    notes: s.notes,
    unknown: s.unknown,
    untranslated: s.leftover,
  };
}

function report(result) {
  const lines = [
    `formal-ai: ${result.stats.complete}/${result.stats.sentences} sentences fully translated`,
  ];
  for (const s of result.sentences.filter((x) => !x.complete)) {
    lines.push(`  ! ${s.source}`);
    if (s.unknown.length) {
      lines.push(`    unknown words: ${s.unknown.join(', ')}`);
    }
    if (s.leftover.length) {
      lines.push(`    not parsed: ${s.leftover.join(' ')}`);
    }
  }
  return lines.join('\n');
}

main().catch((error) => {
  process.stderr.write(`formal-ai: ${error.message}\n`);
  process.exitCode = 1;
});
