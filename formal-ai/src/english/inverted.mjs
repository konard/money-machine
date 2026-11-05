/** Yes/no and wh-questions with subject–aux inversion. */
import { clause } from './clause-node.mjs';
import {
  Cursor,
  has,
  reading,
  parseNP,
  parseVerbGroup,
  parseTail,
} from './parser.mjs';

/** Undo subject–aux inversion: "Do you like tea" → "you do like tea". */
export function parseInverted(c, ctx, wh, tailOptions) {
  const auxStart = c.i;
  const aux = [c.next()];
  while (has(c.peek, 'neg')) {
    aux.push(c.next());
  }
  // "Is there a bank here?": an existential question
  if (has(aux[0], 'be') && has(c.peek, 'there') && !wh) {
    c.next();
    const reordered = new Cursor([...aux, ...c.tokens.slice(c.i)]);
    reordered.grammar = ctx;
    const vg = parseVerbGroup(reordered);
    const theme = vg && parseNP(reordered);
    if (theme) {
      const tail = parseTail(reordered, 'event', ctx);
      c.i += reordered.i - aux.length;
      return clause('question', vg, {
        frame: 'existence',
        subject: theme,
        ...tail,
      });
    }
    c.i = auxStart;
    return null;
  }
  const subjectStart = c.i;
  let subject = parseNP(c);
  if (!subject) {
    // "Who lives here?" – the wh-word is the subject
    c.i = auxStart;
    return null;
  }
  // "Does the plan work?": the verb is not the subject's last noun
  const last = c.at(-1);
  if (
    c.i - subjectStart > 1 &&
    !c.tokens.slice(c.i).some((t) => has(t, 'verb')) &&
    reading(last, 'verb')?.features.form?.includes('base')
  ) {
    const shorter = new Cursor(c.tokens.slice(0, c.i - 1));
    shorter.grammar = c.grammar;
    shorter.i = subjectStart;
    const np = parseNP(shorter);
    if (np && shorter.done) {
      subject = np;
      c.i -= 1;
    }
  }
  const rest = c.tokens.slice(c.i);
  const reordered = new Cursor([...aux, ...rest]);
  reordered.grammar = ctx;
  const vg = parseVerbGroup(reordered, 'question');
  if (!vg) {
    c.i = auxStart;
    return null;
  }
  const tail = parseTail(reordered, vg.frame, tailOptions(ctx, vg));
  c.i += reordered.i - aux.length;
  return clause('question', vg, { subject, ...tail, wh });
}
