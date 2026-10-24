"""Builds public/compare/xrefs.json (Related verses) from OpenBible.info's cross references (CC-BY).

Download https://a.openbible.info/data/cross-references.zip, unzip it, then:
    python3 scripts/build-xrefs.py cross_references.txt
Keeps each verse's most-voted references (up to 10, with at least 3 votes), as
{"book.chapter.verse": [book, chapter, verse, endVerse, ...]} with books counted from 0 in Bible order.
"""
import json
import sys
from collections import defaultdict

BOOKS = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer '
         'Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal '
         'Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev').split()
INDEX = {b: i for i, b in enumerate(BOOKS)}


def ref(s):
    b, c, v = s.split('.')
    return INDEX[b], int(c), int(v)


refs = defaultdict(list)
with open(sys.argv[1], encoding='utf-8') as f:
    next(f)
    for line in f:
        frm, to, votes = line.rstrip('\n').split('\t')[:3]
        votes = int(votes)
        if votes < 3:
            continue
        start, _, end = to.partition('-')
        b, c, v = ref(start)
        e = v
        if end:
            eb, ec, ev = ref(end)
            e = ev if (eb, ec) == (b, c) else v  # a range into the next chapter: just its first verse
        fb, fc, fv = ref(frm)
        refs[f'{fb}.{fc}.{fv}'].append((votes, b, c, v, e))

out = {k: [n for _, *r in sorted(rs, reverse=True)[:10] for n in r] for k, rs in refs.items()}
with open('public/compare/xrefs.json', 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(len(out), 'verses')
