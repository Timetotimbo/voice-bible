import { describe, expect, it } from 'vitest';
import { continueList, muteMarkers, toggleCheck, toggleList } from './noteLists';

describe('toggleList', () => {
  it('numbers the selected lines, skipping empty ones', () => {
    const text = 'Milk\n\nEggs\nBread';
    expect(toggleList(text, 0, text.length, 'number').text).toBe('1. Milk\n\n2. Eggs\n3. Bread');
  });
  it('turns a list back into plain lines', () => {
    const text = '• Milk\n• Eggs';
    expect(toggleList(text, 0, text.length, 'bullet').text).toBe('Milk\nEggs');
  });
  it('swaps one kind of list for another', () => {
    expect(toggleList('1. Milk\n2. Eggs', 0, 15, 'check').text).toBe('☐ Milk\n☐ Eggs');
  });
  it('starts a list on the cursor line, even an empty one, and keeps the cursor after the words', () => {
    expect(toggleList('Intro\nPray', 8, 8, 'check')).toEqual({ text: 'Intro\n☐ Pray', start: 12, end: 12 });
    expect(toggleList('Intro\n', 6, 6, 'bullet')).toEqual({ text: 'Intro\n• ', start: 8, end: 8 });
  });
  it('carries numbering on from the line above', () => {
    expect(toggleList('1. Milk\nEggs', 9, 9, 'number').text).toBe('1. Milk\n2. Eggs');
  });
  it('keeps ticked boxes ticked when making a checklist again', () => {
    expect(toggleList('☑ Milk\nEggs', 0, 12, 'check').text).toBe('☑ Milk\n☐ Eggs');
  });
});

describe('continueList', () => {
  it('gives the next line the next number', () => {
    expect(continueList('1. Milk', 7)).toEqual({ text: '1. Milk\n2. ', caret: 11 });
  });
  it('gives a fresh unticked box after a ticked one', () => {
    expect(continueList('☑ Milk', 6)).toEqual({ text: '☑ Milk\n☐ ', caret: 9 });
  });
  it('ends the list on an empty item', () => {
    expect(continueList('• Milk\n• ', 9)).toEqual({ text: '• Milk\n', caret: 7 });
  });
  it('leaves ordinary lines alone', () => {
    expect(continueList('Milk', 4)).toBeNull();
  });
});

describe('toggleCheck', () => {
  it('ticks and unticks a box tapped on or just after it', () => {
    expect(toggleCheck('Intro\n☐ Pray', 6)).toBe('Intro\n☑ Pray');
    expect(toggleCheck('Intro\n☑ Pray', 7)).toBe('Intro\n☐ Pray');
  });
  it('ignores taps elsewhere in the line', () => {
    expect(toggleCheck('☐ Pray', 4)).toBeNull();
    expect(toggleCheck('Pray', 0)).toBeNull();
  });
});

it('muteMarkers blanks the marks but keeps the length', () => {
  expect(muteMarkers('☐ Pray\n• Read')).toBe('  Pray\n  Read');
});
