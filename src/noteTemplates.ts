import { t } from './i18n';

/**
 * Templates for + New note: a few ready-made outlines, and any note you've saved as a template
 * (kept on this device, and in a backup, under vb_note_templates). {date} becomes today's date.
 */
export interface NoteTemplate {
  id: string;
  name: string;
  title: string;
  text: string;
  mine?: boolean; // saved from one of your notes (can be removed)
}

const KEY = 'vb_note_templates';

export const builtInTemplates = (): NoteTemplate[] => [
  {
    id: 'sermon',
    name: t('🎤 Sermon outline'),
    title: '',
    text: t('Text: \n\nBig idea: \n\nIntroduction\n• \n\n1. \n• \n\n2. \n• \n\n3. \n• \n\nIllustration\n• \n\nApplication\n• \n\nClose and prayer\n• '),
  },
  {
    id: 'soap',
    name: t('📖 Bible study (SOAP)'),
    title: t('Study {date}'),
    text: t('Scripture\n\n\nObservation (what does it say?)\n• \n\nApplication (what will I do?)\n• \n\nPrayer\n'),
  },
  {
    id: 'listening',
    name: t('📝 Notes on a sermon I heard'),
    title: '',
    text: t('Speaker: \nDate: {date}\nText: \n\nKey points\n1. \n2. \n3. \n\nVerses mentioned\n• \n\nMy takeaway\n'),
  },
  {
    id: 'prayer',
    name: t('🙏 Prayer list'),
    title: t('Prayer list'),
    text: t('Praying for\n☐ \n☐ \n☐ \n\nAnswered\n☑ '),
  },
];

export function loadMyTemplates(): NoteTemplate[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as NoteTemplate[]).map(x => ({ ...x, mine: true }));
  } catch {
    return [];
  }
}

function saveMine(list: NoteTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ mine: _, ...x }) => x)));
  } catch {
    // storage full; not kept
  }
}

export function addMyTemplate(name: string, title: string, text: string) {
  saveMine([{ id: `${Date.now()}`, name, title, text }, ...loadMyTemplates()]);
}

export function removeMyTemplate(id: string) {
  saveMine(loadMyTemplates().filter(x => x.id !== id));
}

/** The title and text a template starts a note with, today's date filled in. */
export function fillTemplate(tp: NoteTemplate) {
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return { title: tp.title.replaceAll('{date}', date), text: tp.text.replaceAll('{date}', date) };
}
