/**
 * Sync's three-way merge: `base` is what this device and the account last agreed on, `local` is this device now,
 * `remote` is the account now. A side that didn't change since `base` takes the other's change. When both changed:
 * lists of things with ids (notes, verse lists, chats, the run sheet) merge item by item; a map (highlights) merges
 * key by key; a list of ids (🎨 notes) merges as a set; anything else keeps this device's version.
 * Nothing that's new on either side is lost, and an edit beats a delete.
 */
type Json = unknown;
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (x: Json): x is Record<string, Json> => !!x && typeof x === 'object' && !Array.isArray(x);
const withIds = (x: Json): x is { id: string }[] => Array.isArray(x) && x.every(i => isObj(i) && typeof i.id === 'string');
const ofStrings = (x: Json): x is string[] => Array.isArray(x) && x.every(i => typeof i === 'string');

/** One item changed on both sides: the one changed since base, else the newer (by `updated`), else this device's. */
function pick<T>(b: T | undefined, l: T, r: T): T {
  if (same(l, r) || same(b, r)) return l;
  if (same(b, l)) return r;
  const lu = isObj(l) && typeof l.updated === 'number' ? l.updated : null;
  const ru = isObj(r) && typeof r.updated === 'number' ? r.updated : null;
  return lu !== null && ru !== null && ru > lu ? r : l;
}

/** Whether a thing on one side survives: new since base stays; one the other side deleted stays only if it was edited. */
function keep<T>(b: T | undefined, x: T): boolean {
  return b === undefined || !same(b, x);
}

function byId(b: { id: string }[], l: { id: string }[], r: { id: string }[]) {
  const B = new Map(b.map(i => [i.id, i])), L = new Map(l.map(i => [i.id, i])), R = new Map(r.map(i => [i.id, i]));
  const out: { id: string }[] = [];
  // New on the other device: at the top (where the app puts new things)
  for (const i of r) if (!L.has(i.id) && !B.has(i.id)) out.push(i);
  for (const i of l) {
    const ri = R.get(i.id);
    if (ri) out.push(pick(B.get(i.id), i, ri));
    else if (keep(B.get(i.id), i)) out.push(i); // new here, or edited here after the other device deleted it
  }
  // Deleted here but edited on the other device since: back where it was there
  for (const i of r) if (!L.has(i.id) && B.has(i.id) && !same(B.get(i.id), i)) out.push(i);
  return out;
}

function byKey(b: Record<string, Json>, l: Record<string, Json>, r: Record<string, Json>) {
  const out: Record<string, Json> = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const inL = k in l, inR = k in r, bv = k in b ? b[k] : undefined;
    if (inL && inR) out[k] = pick(bv, l[k], r[k]);
    else if (inL ? keep(bv, l[k]) : keep(bv, r[k])) out[k] = inL ? l[k] : r[k];
  }
  return out;
}

function asSet(b: string[], l: string[], r: string[]) {
  const B = new Set(b), L = new Set(l), R = new Set(r);
  return [...new Set([...l, ...r])].filter(x => !(B.has(x) && (!L.has(x) || !R.has(x))));
}

export function merge(base: Json, local: Json, remote: Json): Json {
  if (remote === undefined || same(local, remote) || same(base, remote)) return local;
  if (local === undefined || same(base, local)) return remote;
  if (withIds(local) && withIds(remote)) return byId(withIds(base) ? base : [], local, remote);
  if (ofStrings(local) && ofStrings(remote)) return asSet(ofStrings(base) ? base : [], local, remote);
  if (isObj(local) && isObj(remote) && !('id' in local)) return byKey(isObj(base) ? base : {}, local, remote);
  return local;
}
