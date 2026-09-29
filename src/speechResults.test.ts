import { describe, expect, it } from 'vitest';
import { createResultReader } from './speechResults';

type R = [text: string, final: boolean];
const event = (resultIndex: number, ...results: R[]) => ({
  resultIndex,
  results: results.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
});

describe('reading speech results', () => {
  it('passes each finished phrase on once (desktop Chrome)', () => {
    const r = createResultReader();
    expect(r.read(event(0, ['when we are', false])).phrases).toEqual([]);
    expect(r.read(event(0, ['when we are afraid', true])).phrases).toEqual(['when we are afraid']);
    expect(r.read(event(1, ['when we are afraid', true], ['God is with us', true])).phrases).toEqual(['God is with us']);
  });

  it('drops the earlier words Android repeats at the start of a new result', () => {
    const r = createResultReader();
    expect(r.read(event(0, ['when we are afraid', true])).phrases).toEqual(['when we are afraid']);
    const next = r.read(event(1, ['when we are afraid', true], ['when we are afraid God is with us', true]));
    expect(next.phrases).toEqual(['God is with us']);
    expect(r.read(event(2, ['x', true], ['y', true], ['when we are afraid God is with us always', true])).phrases).toEqual(['always']);
  });

  it('ignores a finished result sent twice, and shows only the new words live', () => {
    const r = createResultReader();
    r.read(event(0, ['grace is a gift', true]));
    expect(r.read(event(1, ['grace is a gift', true], ['Grace is a gift', true])).phrases).toEqual([]);
    expect(r.read(event(2, ['grace is a gift', true], ['grace is a gift', true], ['grace is a gift from', false])).interim).toBe('from');
  });

  it('starts fresh after reset', () => {
    const r = createResultReader();
    r.read(event(0, ['amen', true]));
    r.reset();
    expect(r.read(event(0, ['amen', true])).phrases).toEqual(['amen']);
  });
});
