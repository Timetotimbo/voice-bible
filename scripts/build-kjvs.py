# Builds the "KJV + Strong's" translation and the Strong's dictionary for word study:
#   public/bibles/kjvs.json    66 books → chapters → verse strings, with each tagged word written {word|H430}
#   public/bibles/strongs.json {"H430": [lemma, transliteration, pronunciation, definition, KJV renderings, derivation]}
# Sources: eBible.org's KJV with Strong's numbers (public domain, via CrossWire) and Open Scriptures'
# Strong's Hebrew and Greek dictionaries (CC BY-SA; the app credits them where definitions are shown).
#   python3 scripts/build-kjvs.py
import io, json, pathlib, re, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'bibles'
USFM = 'https://ebible.org/Scriptures/eng-kjv2006_usfm.zip'
DICTS = 'https://raw.githubusercontent.com/openscriptures/strongs/master/{0}/strongs-{0}-dictionary.js'
BOOKS = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
         'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
         'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
         'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN',
         'JUD', 'REV']


def fetch(url: str) -> bytes:
    # eBible.org turns away Python's default user agent
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'voice-bible-build'})) as r:
        return r.read()


def code(raw: str) -> str:
    """ "H0430" → "H430" """
    return raw[0] + str(int(raw[1:]))


def verse_text(usfm: str) -> str:
    s = re.sub(r'\\f .*?\\f\*', '', usfm)  # footnotes
    s = re.sub(r'\\x .*?\\x\*', '', s)  # cross references
    # \w word|strong="H430"\w*, or \+w … \+w* inside the words of Jesus
    s = re.sub(r'\\\+?w (.*?)\|strong="([HG]\d+)"\\\+?w\*', lambda m: '{%s|%s}' % (m.group(1), code(m.group(2))), s)
    s = re.sub(r'\\\+?[a-z]+\d*\*?', '', s)  # every other marker: \add, \nd, \wj, \q1, \p …
    s = s.replace('¶', '')  # paragraph marks, which the plain KJV text doesn't have
    return re.sub(r'\s+', ' ', s).replace(' ,', ',').strip()


def build_bible() -> list:
    z = zipfile.ZipFile(io.BytesIO(fetch(USFM)))
    names = {re.search(r'\d\d-(\w{3})', n).group(1): n for n in z.namelist() if n.endswith('.usfm')}
    bible = []
    for book in BOOKS:
        chapters: list[list[str]] = []
        verse = None
        for line in z.read(names[book]).decode('utf-8-sig').splitlines():
            if m := re.match(r'\\c (\d+)', line):
                chapters.append([])
                verse = None
            elif m := re.match(r'\\v (\d+) ?(.*)', line):
                chapters[-1].append(m.group(2))
                verse = len(chapters[-1]) - 1
            elif verse is not None and chapters and not re.match(r'\\(d|s\d?|ms|mt\d?|h|toc\d|id)\b', line):
                chapters[-1][verse] += ' ' + line  # poetry and paragraph lines carry on the verse
        bible.append([[verse_text(v) for v in ch] for ch in chapters])
    return bible


def build_dictionary() -> dict:
    out = {}
    for lang in ('hebrew', 'greek'):
        js = fetch(DICTS.format(lang)).decode('utf-8')
        data = json.loads(js[js.index('{'):js.rindex('}') + 1])
        for key, e in data.items():
            out[key] = [e.get('lemma', ''), e.get('xlit') or e.get('translit', ''), e.get('pron', ''),
                        (e.get('strongs_def') or '').strip(), (e.get('kjv_def') or '').strip(), (e.get('derivation') or '').strip()]
    return out


if __name__ == '__main__':
    bible = build_bible()
    kjv = json.loads((OUT / 'kjv.json').read_text(encoding='utf-8'))
    # Same books, chapters and verses as the plain KJV, so references, lists and recordings line up
    shape = lambda b: [[len(ch) for ch in book] for book in b]
    assert shape(bible) == shape(kjv), 'verse layout differs from kjv.json'
    (OUT / 'kjvs.json').write_text(json.dumps(bible, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    words = build_dictionary()
    (OUT / 'strongs.json').write_text(json.dumps(words, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for f in ('kjvs.json', 'strongs.json'):
        print(f, (OUT / f).stat().st_size)
    print(bible[0][0][0])
    print(bible[42][2][15])
