import { describe, expect, it } from 'vitest';
import { appendDictation } from './dictation';

describe('dictating into a note', () => {
  it('adds phrases with a space and a capital to start', () => {
    expect(appendDictation('', 'grace is a gift')).toBe('Grace is a gift');
    expect(appendDictation('Grace is a gift', 'from God')).toBe('Grace is a gift from God');
  });

  it('turns spoken punctuation into marks', () => {
    expect(appendDictation('', 'grace is a gift period it cannot be earned comma only received')).toBe(
      'Grace is a gift. It cannot be earned, only received',
    );
    expect(appendDictation('What is faith', 'question mark')).toBe('What is faith?');
  });

  it('starts new lines and paragraphs', () => {
    expect(appendDictation('Point one.', 'new line point two')).toBe('Point one.\nPoint two');
    expect(appendDictation('Intro.', 'new paragraph first the word')).toBe('Intro.\n\nFirst the word');
  });

  it('leaves the note alone for an empty phrase', () => {
    expect(appendDictation('Text', '   ')).toBe('Text');
  });
});
