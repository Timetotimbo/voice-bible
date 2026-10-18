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

describe('tocLinks when the book prints its headings in Title Case', () => {
  const note = `TABLE OF CONTENTS
SCRIPTURE SETTING 9
11 4 FACTS ABOUT OFFERINGS 77
12 7 LAWS OF WEALTH 78
13 31 REASONS PEOPLE DO NOT RECEIVE THEIR 79
FINANCIAL HARVEST
Unless otherwise indicated, all Scripture quotations are taken from the King James Version of the Bible.
Some more sentences here to end the list properly.
11
4 Facts About Offerings
1. An offering is a seed. (Mark 9)
12
7 Laws of Wealth
1. The Law of Belief. (Mark 9:23)
13
31 Reasons People Do Not Receive Their
Financial Harvest
1. Because they do not.
`;
  it('finds a heading that has the chapter number before the title on the same line', () => {
    const n2 = note.replace('\n12\n7 Laws of Wealth', '\n12 7 Laws of Wealth');
    const l = tocLinks(n2).map(x => n2.slice(x.target, x.targetEnd));
    expect(l).toContain('7 Laws of Wealth');
  });
  it('links each capitals title to its whole heading line, number and wrapped line included, with no copy of the contents', () => {
    const links = tocLinks(note);
    expect(links.map(l => note.slice(l.target, l.targetEnd))).toEqual(['4 Facts About Offerings', '7 Laws of Wealth', '31 Reasons People Do Not Receive Their\nFinancial Harvest']);
  });
});

describe('tocLinks for titles one to a line, with no Contents heading', () => {
  const titles = [
    'WISDOM BIBLE',
    '10 qualities of uncommon achievers ',
    '18 facts you should know about the anointing. ',
    '11 steps for overcoming bitterness The Covenant of the 58 blessings ',
    '20 keys for winning at work 31 facts. You should know about wisdom ',
    '7 facts you should know about conflict. ',
  ].join('\n');
  const body = [
    '10 QUALITIES OF UNCOMMON ACHIEVERS\nThey know what they want. They hate losing.',
    '18 Facts You Should Know About The Anointing\nThe anointing is the power of God.',
    '11 Steps For Overcoming Bitterness\nForgive.',
    'The Covenant Of The 58 Blessings\nBlessed.',
    '20 Keys For Winning At Work\nBe on time.',
    '31 Facts You Should Know About Wisdom\nWisdom is the principal thing.',
    '7 Facts You Should Know About Conflict\nPeace.',
  ].join('\n\n');
  const note = `${titles}\n\n${body}`;
  const links = tocLinks(note);
  const pairs = links.map(l => [note.slice(l.start, l.end), note.slice(l.target, l.targetEnd)]);
  it('links each title to its heading, splitting lines that hold two', () => {
    expect(pairs).toEqual([
      ['10 qualities of uncommon achievers', '10 QUALITIES OF UNCOMMON ACHIEVERS'],
      ['18 facts you should know about the anointing', '18 Facts You Should Know About The Anointing'],
      ['11 steps for overcoming bitterness', '11 Steps For Overcoming Bitterness'],
      ['The Covenant of the 58 blessings', 'The Covenant Of The 58 Blessings'],
      ['20 keys for winning at work', '20 Keys For Winning At Work'],
      ['31 facts. You should know about wisdom', '31 Facts You Should Know About Wisdom'],
      ['7 facts you should know about conflict', '7 Facts You Should Know About Conflict'],
    ]);
  });
  it('a note with a line said twice is not contents', () => {
    expect(tocLinks('Praise Him\nPraise Him\nHallelujah, praise Him')).toEqual([]);
  });
});
