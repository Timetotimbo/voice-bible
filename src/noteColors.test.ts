import { expect, it } from 'vitest';
import { sentenceRanges } from './noteColors';

const pieces = (text: string) => sentenceRanges(text).map(r => text.slice(r.start, r.end));

it('splits a note into sentences and lines', () => {
  expect(pieces('God’s gonna heal everyone here tonight.\nSomebody said God is dead. If God Is dead, He’s died since last night. People are jumping!'))
    .toEqual(['God’s gonna heal everyone here tonight.', 'Somebody said God is dead.', 'If God Is dead, He’s died since last night.', 'People are jumping!']);
});

it('keeps closing quotes with their sentence, and verse references whole', () => {
  expect(pieces('He said, “Rise up.” Read John 3:16 today\n\nAmen')).toEqual(['He said, “Rise up.”', 'Read John 3:16 today', 'Amen']);
});
