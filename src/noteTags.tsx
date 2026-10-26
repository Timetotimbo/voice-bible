import { useEffect, useState } from 'react';
import { t } from './i18n';

/**
 * Note tags: six colours, each with a name you give it ("Sermons", "Prayer"). A note can have several.
 * The names are kept on this device (and in a backup) as {"purple": "Sermons"}; a note keeps just its colours.
 */
export const TAG_COLORS = ['purple', 'blue', 'green', 'yellow', 'orange', 'red'] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export type TagNames = Partial<Record<TagColor, string>>;

const KEY = 'vb_note_tags';
const EVENT = 'vb-note-tags';

function load(): TagNames {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function useTagNames() {
  const [names, setNames] = useState(load);
  useEffect(() => {
    const on = (e: Event) => setNames((e as CustomEvent<TagNames>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const rename = (color: TagColor, name: string) => {
    const next = { ...load(), [color]: name.trim() };
    if (!next[color]) delete next[color];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // lasts for this visit
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };
  return { names, rename };
}

/** A tag's name, or its colour until it's named. */
export const tagLabel = (color: TagColor, names: TagNames) => names[color] || t(color).replace(/^./, c => c.toUpperCase());

/** A note's tags as small coloured dots. */
export function TagDots({ tags, names }: { tags?: TagColor[]; names: TagNames }) {
  if (!tags?.length) return null;
  return (
    <span className="tag-dots" aria-label={tags.map(c => tagLabel(c, names)).join(', ')}>
      {TAG_COLORS.filter(c => tags.includes(c)).map(c => <i key={c} className={`tag-dot tag-${c}`} />)}
    </span>
  );
}

/** Tags for one note: tick the colours it has, and name (or rename) any colour. */
export function TagSheet({ title, tags, onChange, onClose }: {
  title: string;
  tags: TagColor[];
  onChange: (tags: TagColor[]) => void;
  onClose: () => void;
}) {
  const { names, rename } = useTagNames();
  const [naming, setNaming] = useState<TagColor | null>(null);
  const [draft, setDraft] = useState('');
  const toggle = (c: TagColor) => onChange(tags.includes(c) ? tags.filter(x => x !== c) : TAG_COLORS.filter(x => x === c || tags.includes(x)));
  const save = () => {
    if (naming) rename(naming, draft);
    setNaming(null);
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Tags')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('🏷 Tags for “{name}”', { name: title })}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <ul className="sheet-list">
          {TAG_COLORS.map(c => (
            <li key={c} className="tag-row">
              {naming === c ? (
                <form className="tag-name-form" onSubmit={e => { e.preventDefault(); save(); }}>
                  <i className={`tag-dot big tag-${c}`} aria-hidden />
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setNaming(null)}
                    placeholder={t('Name for {color}, e.g. Sermons', { color: t(c) })}
                    aria-label={t('Name for {color}', { color: t(c) })}
                    maxLength={30}
                    enterKeyHint="done"
                  />
                  <button type="submit">{t('Save')}</button>
                </form>
              ) : (
                <>
                  <button className="sheet-item tag-pick" role="checkbox" aria-checked={tags.includes(c)} onClick={() => toggle(c)}>
                    <span className="tag-check" aria-hidden>{tags.includes(c) ? '☑' : '☐'}</span>
                    <i className={`tag-dot big tag-${c}`} aria-hidden />
                    <span className={names[c] ? '' : 'tag-unnamed'}>{tagLabel(c, names)}</span>
                  </button>
                  <button className="sheet-x" aria-label={t('Rename {tag}', { tag: tagLabel(c, names) })} title={t('Name this colour')} onClick={() => { setDraft(names[c] ?? ''); setNaming(c); }}>✎</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="notice">{t('Tap ✎ to name a colour. Names work for every note.')}</p>
      </div>
    </div>
  );
}
