export interface RecognitionResults {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

/**
 * Turns a listening session's result events into new phrases, once each. Chrome on Android, listening
 * continuously, can send a finished result again, or start each new result with the words it already sent
 * ("when we are afraid", then "when we are afraid God is with us"); only the new words are passed on.
 * Call `reset` when a session starts.
 */
export function createResultReader() {
  const done = new Set<number>(); // finished results already handled, by position in the session
  let heard = ''; // everything finished so far this session, to recognise it repeated at the start of a result

  const fresh = (text: string) => {
    const said = text.trim();
    const before = heard.trim();
    if (!before) return said;
    const lower = said.toLowerCase();
    if (lower === before.toLowerCase()) return '';
    if (lower.startsWith(`${before.toLowerCase()} `)) return said.slice(before.length).trim();
    return said;
  };

  return {
    reset() {
      done.clear();
      heard = '';
    },
    /** New finished phrases in this event (new words only), and what's being heard right now (for showing live). */
    read(e: RecognitionResults): { phrases: string[]; interim: string } {
      const phrases: string[] = [];
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript;
        if (res.isFinal) {
          if (done.has(i)) continue;
          done.add(i);
          const add = fresh(text);
          // Remember the whole session so far, whichever way Chrome is sending it
          heard = text.trim().toLowerCase().startsWith(heard.trim().toLowerCase()) && heard ? text.trim() : `${heard} ${text.trim()}`.trim();
          if (add) phrases.push(add);
        } else if (i >= e.resultIndex) {
          interim += `${fresh(text)} `;
        }
      }
      return { phrases, interim: interim.trim() };
    },
  };
}
