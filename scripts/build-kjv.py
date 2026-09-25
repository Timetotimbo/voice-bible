# Converts the source KJV JSON (thiagobodruk/bible, public domain text) into
# public/bibles/kjv.json: an array of 66 books, each an array of chapters of verse strings.
import json, pathlib
root = pathlib.Path(__file__).parent
src = json.loads((root / 'kjv-src.json').read_text(encoding='utf-8-sig'))
out = root.parent / 'public' / 'bibles' / 'kjv.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps([b['chapters'] for b in src], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(out, out.stat().st_size)
