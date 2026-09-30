import { describe, expect, it } from 'vitest';
import { appendDictation, insertDictation } from './dictation';
import { setUiLanguage } from './i18n';

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

describe('dictating where the cursor is', () => {
  it('puts the phrase at the cursor, with spaces either side', () => {
    const text = 'Grace is a gift. Faith comes by hearing.';
    const at = text.indexOf(' Faith');
    expect(insertDictation(text, at, 'it cannot be earned period')).toEqual({
      text: 'Grace is a gift. It cannot be earned. Faith comes by hearing.',
      caret: 'Grace is a gift. It cannot be earned.'.length,
    });
  });

  it('joins onto a word the cursor sits before', () => {
    expect(insertDictation('Grace gift', 6, 'is a')).toEqual({ text: 'Grace is a gift', caret: 10 });
  });

  it('adds at the end like before when the cursor is there', () => {
    expect(insertDictation('Intro.', 6, 'new paragraph first')).toEqual({ text: 'Intro.\n\nFirst', caret: 13 });
  });
});

describe('dictating in Spanish', () => {
  it('turns spoken Spanish punctuation into marks', () => {
    setUiLanguage('es');
    try {
      expect(appendDictation('', 'la gracia es un don punto no se gana coma se recibe')).toBe('La gracia es un don. No se gana, se recibe');
      expect(appendDictation('Uno', 'punto y coma dos dos puntos tres')).toBe('Uno; dos: tres');
      expect(appendDictation('Intro.', 'nuevo párrafo primero la palabra')).toBe('Intro.\n\nPrimero la palabra');
    } finally {
      setUiLanguage('en');
    }
  });
});
