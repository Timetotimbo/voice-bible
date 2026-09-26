# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["kokoro-onnx>=0.4", "lameenc", "numpy"]
# ///
# Records the Bible with the open Kokoro voice model for the app's "Natural voices" (see src/recorded.ts).
#
#   uv run scripts/record-kokoro.py                   # whole Bible, af_heart voice, into audio/
#   uv run scripts/record-kokoro.py --books John,Psalms
#
# Writes VOICE/BOOK/CHAPTER.mp3 + .json (the second each verse starts at) and VOICE/refs/{chapters,verses}.mp3
# + .json ([start, end] of every "John 3," and "verse 16." clip). Finished chapters are skipped, so it can be
# stopped and restarted. The model (~340 MB) downloads once to scripts/.kokoro/. The full Bible is about
# 75 hours of audio, roughly 1.6 GB of MP3.
import argparse, json, pathlib, re, sys, time, urllib.request
import lameenc, numpy as np
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parent
MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
MODEL_FILES = ['kokoro-v1.0.onnx', 'voices-v1.0.bin']
RATE = 24000
LEAD = 0.25  # silence at the start of each file
GAP = 0.5  # silence between verses; a verse's start is marked partway into the gap before it
MARK = 0.15  # how far before the speech a start is marked, so seeking never clips the first word
ORDINAL = {'1': 'First', '2': 'Second', '3': 'Third'}


def book_names() -> list[str]:
    src = (ROOT.parent / 'src' / 'bible' / 'books.ts').read_text()
    body = re.search(r'BOOKS = \[(.*?)\]', src, re.S).group(1)
    return re.findall(r"'([^']+)'", body)


def spoken_book(name: str) -> str:
    """Same wording as spokenReference in src/useReader.ts."""
    name = re.sub(r'^([123]) ', lambda m: ORDINAL[m.group(1)] + ' ', name)
    return 'Psalm' if name == 'Psalms' else name


def load_model() -> Kokoro:
    cache = ROOT / '.kokoro'
    cache.mkdir(exist_ok=True)
    for name in MODEL_FILES:
        path = cache / name
        if not path.exists():
            print(f'Downloading {name}…', flush=True)
            urllib.request.urlretrieve(MODEL_URL + name, path.with_suffix('.part'))
            path.with_suffix('.part').rename(path)
    return Kokoro(str(cache / MODEL_FILES[0]), str(cache / MODEL_FILES[1]))


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * RATE), dtype=np.float32)


def trim(samples: np.ndarray, threshold=0.01) -> np.ndarray:
    loud = np.flatnonzero(np.abs(samples) > threshold)
    return samples[loud[0]:loud[-1] + 1] if loud.size else samples[:0]


def write_mp3(path: pathlib.Path, samples: np.ndarray):
    enc = lameenc.Encoder()
    enc.set_bit_rate(48)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes()
    tmp = path.with_suffix('.part')
    tmp.write_bytes(enc.encode(pcm) + enc.flush())
    tmp.rename(path)


def record(kokoro: Kokoro, voice: str, lines: list[str]) -> tuple[np.ndarray, list[float]]:
    """Speaks each line in turn with a gap between; returns the audio and where each line starts."""
    parts, starts, at = [silence(LEAD)], [], LEAD
    for line in lines:
        samples, rate = kokoro.create(line, voice=voice, speed=1.0, lang='en-us')
        assert rate == RATE, rate
        speech = trim(samples)
        starts.append(round(max(0.0, at - MARK), 3))
        parts += [speech, silence(GAP)]
        at += (len(speech) + int(GAP * RATE)) / RATE
    return np.concatenate(parts), starts


def record_clips(kokoro: Kokoro, voice: str, lines: list[str], path: pathlib.Path):
    """A file of short clips with [start, end] seconds for each, ends marked partway into the gap after."""
    if path.with_suffix('.json').exists():
        return
    audio, starts = record(kokoro, voice, lines)
    ends = [s - (GAP - 2 * MARK) for s in starts[1:]] + [len(audio) / RATE - (GAP - MARK)]
    write_mp3(path.with_suffix('.mp3'), audio)
    path.with_suffix('.json').write_text(json.dumps([[s, round(e, 3)] for s, e in zip(starts, ends)]))
    print(f'  {path.relative_to(path.parents[1])}: {len(lines)} clips', flush=True)


def main():
    books = book_names()
    ap = argparse.ArgumentParser(description='Record the Bible with Kokoro for the Natural voices.')
    ap.add_argument('--voice', default='af_heart', help='Kokoro voice id (default af_heart)')
    ap.add_argument('--out', type=pathlib.Path, default=ROOT.parent / 'audio', help='output folder (default audio/)')
    ap.add_argument('--books', help='comma-separated book names to record, e.g. "John,Psalms" (default all)')
    ap.add_argument('--no-refs', action='store_true', help="skip the reference clips (they're recorded once, first)")
    args = ap.parse_args()

    bible = json.loads((ROOT.parent / 'public' / 'bibles' / 'kjv.json').read_text(encoding='utf-8'))
    wanted = range(len(books))
    if args.books:
        lookup = {b.lower(): i for i, b in enumerate(books)}
        names = [n.strip().lower() for n in args.books.split(',')]
        if bad := [n for n in names if n not in lookup]:
            sys.exit(f'Unknown book(s): {", ".join(bad)}')
        wanted = sorted(lookup[n] for n in names)

    kokoro = load_model()
    out = args.out / args.voice
    (out / 'refs').mkdir(parents=True, exist_ok=True)

    # Reference clips cover every chapter and verse number, so the Refs option works wherever reading starts
    if not args.no_refs:
        record_clips(kokoro, args.voice, [f'{spoken_book(b)} {c + 1},' for b, chapters in zip(books, bible)
                                          for c in range(len(chapters))], out / 'refs' / 'chapters')
        most = max(len(ch) for chapters in bible for ch in chapters)
        record_clips(kokoro, args.voice, [f'verse {n}.' for n in range(1, most + 1)], out / 'refs' / 'verses')

    todo = [(b, c) for b in wanted for c in range(len(bible[b]))
            if not (out / str(b + 1) / f'{c + 1}.json').exists()]
    print(f'{len(todo)} chapters to record', flush=True)
    began = time.time()
    for n, (b, c) in enumerate(todo, 1):
        folder = out / str(b + 1)
        folder.mkdir(exist_ok=True)
        audio, starts = record(kokoro, args.voice, bible[b][c])
        write_mp3(folder / f'{c + 1}.mp3', audio)
        # The .json is written last: its presence means the chapter is finished
        (folder / f'{c + 1}.json').write_text(json.dumps(starts))
        left = (time.time() - began) / n * (len(todo) - n)
        print(f'[{n}/{len(todo)}] {books[b]} {c + 1}: {len(audio) / RATE / 60:.1f} min · ~{left / 3600:.1f} h left', flush=True)


if __name__ == '__main__':
    main()
