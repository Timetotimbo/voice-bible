import { describe, expect, it } from 'vitest';
import { tocLinks } from './noteToc';

const TOC = 'TABLE OF CONTENTS SCRIPTURE SETTING 9 1 WISDOM KEYS FOR MILLIONAIRES 17 2 136 MILLIONAIRE STUDY GUIDES 69 1 3 REASONS GOD WANTS YOU TO SUCCEED 69 FINANCIALLY 2 12 FACTS YOU SHOULD KNOW ABOUT GIVING 69 3 7 MASTER KEYS TO LIVING IN FINANCIAL PEACE 70 4 UNLOCKING THE LAW OF INCREASE 71 16 5 REASONS WHY CRISIS TIME IS AN 85 IMPORTANT SEASON TO SOW 2 MIKE MURDOC 17 6 BASIC PRINCIPLES OF PROSPERITY 85 ESTABLISHED IN THE BIBLE 38 7 QUESTIONS EVERY ACHIEVER SHOULD ASK HIMSELF102 50 7 KEYS TO FINANCIAL BREAKTHROUGH 114 127 7 KEYS TO FINANCIAL BREAKTHROUGH 208 Unless otherwise indicated, all Scripture quotations are taken from the King James Version of the Bible.';
const HEADER = '\n\nTHE MILLIONAIRE’S BIBLE, VOLUME 1 45\n\n';
const BODY = [
  'SCRIPTURE SETTING\nThe blessing of the Lord makes rich.',
  HEADER,
  '1\nWISDOM KEYS FOR MILLIONAIRES\nWisdom is the principal thing. God wants you to succeed financially, and giving matters.',
  HEADER,
  '2\n136 MILLIONAIRE STUDY GUIDES',
  '1\n3 REASONS GOD WANTS YOU TO SUCCEED FINANCIALLY\nHe wants you blessed.',
  '2\n12 FACTS YOU SHOULD KNOW ABOUT GIVING\nGive and it shall be given.',
  HEADER,
  '3\n7 MASTER KEYS TO LIVING IN FINANCIAL PEACE\nPeace.',
  '4\nUNLOCKING THE LAW OF INCREASE\nIncrease.',
  HEADER,
  '16\n5 REASONS WHY CRISIS TIME IS AN IMPORTANT SEASON TO SOW\nSow.',
  '17\n6 BASIC PRINCIPLES OF PROSPERITY ESTABLISHED IN THE BIBLE\nPrinciples.',
  '38\n7 QUESTIONS EVERY ACHIEVER SHOULD ASK HIMSELF\nAsk.',
  '50\n7 KEYS TO FINANCIAL BREAKTHROUGH\nFirst one.',
  HEADER,
  '127\n7 KEYS TO FINANCIAL BREAKTHROUGH\nSecond one.',
].join('\n\n');
const note = `My notes\n\n${TOC}\n\n${BODY}`;

describe('tocLinks', () => {
  const links = tocLinks(note);
  const linked = links.map(l => note.slice(l.start, l.end));
  const lands = (title: string) => {
    const l = links.find(x => note.slice(x.start, x.end).includes(title))!;
    return note.slice(l.target, l.targetEnd);
  };
  it('links each title in the contents, across its page numbers', () => {
    expect(linked).toContain('3 REASONS GOD WANTS YOU TO SUCCEED 69 FINANCIALLY');
    expect(linked).toContain('1 WISDOM KEYS FOR MILLIONAIRES');
    expect(linked).toContain('SCRIPTURE SETTING');
    expect(linked.some(l => l.includes('QUESTIONS EVERY ACHIEVER SHOULD ASK HIMSELF'))).toBe(true);
  });
  it('lands on the heading, not the same words in a sentence', () => {
    expect(lands('REASONS GOD WANTS')).toBe('3 REASONS GOD WANTS YOU TO SUCCEED FINANCIALLY');
    expect(note.indexOf('3 REASONS GOD WANTS YOU TO SUCCEED FINANCIALLY')).toBe(links.find(l => note.slice(l.start, l.end).includes('REASONS GOD'))!.target);
    expect(lands('ESTABLISHED')).toBe('6 BASIC PRINCIPLES OF PROSPERITY ESTABLISHED IN THE BIBLE');
  });
  it('the same title twice goes to each heading in turn', () => {
    const two = links.filter(l => note.slice(l.start, l.end).includes('KEYS TO FINANCIAL BREAKTHROUGH'));
    expect(two).toHaveLength(2);
    expect(note.slice(two[0].targetEnd, two[0].targetEnd + 12)).toContain('First one');
    expect(note.slice(two[1].targetEnd, two[1].targetEnd + 12)).toContain('Second one');
  });
  it('every link goes forward, past the contents', () => {
    const end = note.indexOf('Unless otherwise');
    for (const l of links) expect(l.target).toBeGreaterThan(end);
  });
  it('no contents, no links', () => {
    expect(tocLinks('Just a sermon about FAITH AND HOPE and more FAITH AND HOPE.')).toEqual([]);
  });
});

describe('tocLinks with the titles listed again in the note', () => {
  const toc = 'TABLE OF CONTENTS 67 31 SECRETS TO CAREER SUCCESS 137 68 7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL 140 WORLD 69 HOW TO SUCCEED ON YOUR JOB 141 70 3 KEYS TO FINANCIAL AUTHORITY 142 71 WHAT TO KNOW TO BECOME A WORLD-CLASS 143 PROBLEM-SOLVER 72 HOW TO BREAK THE FINANCIAL RUT 144 Unless otherwise indicated, all Scripture quotations are taken from the King James Version.';
  const copy = '\n\nCONTENTS 67 31 SECRETS TO CAREER SUCCESS 137 68 7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL 140 WORLD 69 HOW TO SUCCEED ON YOUR JOB 141 70 3 KEYS TO FINANCIAL AUTHORITY 142 71 WHAT TO KNOW TO BECOME A WORLD-CLASS 143 PROBLEM-SOLVER 72 HOW TO BREAK THE FINANCIAL RUT 144\n\n';
  const list = '31 SECRETS TO CAREER SUCCESS\n7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL WORLD\nHOW TO SUCCEED ON YOUR JOB\n3 KEYS TO FINANCIAL AUTHORITY\nWHAT TO KNOW TO BECOME A WORLD-CLASS PROBLEM-SOLVER\nHOW TO BREAK THE FINANCIAL RUT\n\n';
  const flat = '31 SECRETS TO CAREER SUCCESS 7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL WORLD HOW TO SUCCEED ON YOUR JOB 3 KEYS TO FINANCIAL AUTHORITY WHAT TO KNOW TO BECOME A WORLD-CLASS PROBLEM-SOLVER HOW TO BREAK THE FINANCIAL RUT\n\n';
  const chapters = [
    '67\n31 SECRETS TO CAREER SUCCESS\nSuccess is a journey.',
    '68\n7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL WORLD\nDecisions decide wealth.',
    '69\nHOW TO SUCCEED ON YOUR JOB\nBe on time.',
    '70\n3 KEYS TO FINANCIAL AUTHORITY\nAuthority comes.',
    '71\nWHAT TO KNOW TO BECOME A WORLD-CLASS PROBLEM-SOLVER\nSolve problems.',
    '72\nHOW TO BREAK THE FINANCIAL RUT\nBreak it.',
  ].join('\n\n');
  for (const [name, extra] of [['a copy of the contents', copy], ['a list, one title a line', list], ['a list on one line', flat]]) {
    it(`one link per title, landing on the chapter (with ${name})`, () => {
      const note = `${toc}\n\n${extra}${chapters}`;
      const links = tocLinks(note);
      const linked = links.map(l => note.slice(l.start, l.end));
      expect(linked).toEqual([
        '31 SECRETS TO CAREER SUCCESS',
        '7 DECISIONS THAT WILL DECIDE YOUR FINANCIAL 140 WORLD',
        '69 HOW TO SUCCEED ON YOUR JOB',
        '3 KEYS TO FINANCIAL AUTHORITY',
        '71 WHAT TO KNOW TO BECOME A WORLD-CLASS 143 PROBLEM-SOLVER',
        '72 HOW TO BREAK THE FINANCIAL RUT',
      ]);
      const start = note.indexOf('67\n31 SECRETS');
      for (const l of links) expect(l.target).toBeGreaterThanOrEqual(start);
    });
  }
});
