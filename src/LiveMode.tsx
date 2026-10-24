import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from './i18n';
import { noteTitle, type Note } from './useNotes';

/**
 * Live mode, for teaching on a livestream with a camera pointed at the screen: only the notes you pick show
 * anywhere in the app, and your face can sit in a round camera bubble that stays over every screen.
 * Remembered on this device, so a reload in the middle of a live doesn't show every note again.
 */
// presentFace: whether the bubble stays on while verses are presented full screen (📷 in Present)
export type Live = { on: boolean; shown: string[]; face: boolean; shape: BubbleShape; presentFace: boolean };
type BubbleSize = 's' | 'm' | 'l';
/** Round, a narrower oval, or a circle with its top or bottom third cut off flat, to show less of the room */
export type BubbleShape = 'round' | 'narrow' | 'cut-top' | 'cut-bottom';

const KEY = 'liveMode';
const OFF: Live = { on: false, shown: [], face: true, shape: 'round', presentFace: true };
const SHAPES: { id: BubbleShape; label: string }[] = [
  { id: 'round', label: 'Circle' },
  { id: 'narrow', label: 'Narrow' },
  { id: 'cut-top', label: 'Top cut off' },
  { id: 'cut-bottom', label: 'Bottom cut off' },
];

export function useLiveMode() {
  const [live, setLive] = useState<Live>(() => {
    try { return { ...OFF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return OFF; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(live)); } catch { /* private window: just for now */ }
  }, [live]);
  const update = useCallback((patch: Partial<Live>) => setLive(l => ({ ...l, ...patch })), []);
  return { ...live, update };
}

/** Picking the notes people can see, and the face bubble. Set it up before the camera is on the screen. */
export function LiveSheet({ notes, live, onStart, onEnd, onClose, onPreview }: {
  notes: Note[];
  live: Live;
  onStart: (shown: string[], face: boolean, shape: BubbleShape) => void;
  onEnd: () => void;
  onClose: () => void;
  onPreview: (draft: { face: boolean; shape: BubbleShape }) => void; // shows the bubble as picked, before Save
}) {
  const [picked, setPicked] = useState(() => new Set(live.shown.filter(id => notes.some(n => n.id === id))));
  const [face, setFace] = useState(live.face);
  const [shape, setShape] = useState(live.shape);
  useEffect(() => onPreview({ face, shape }), [face, shape, onPreview]);
  const toggle = (id: string) => setPicked(p => {
    const next = new Set(p);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Live mode')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Live mode')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <p className="voice-help live-help">{t('For teaching on a livestream. Only the notes you tick show in the app; the rest are hidden until you end Live mode. Set this up before your camera is on the screen.')}</p>

        <label className="set-row">
          <span>{t('Show my face')}<small className="set-sub">{t('A camera bubble over every screen. Pick its shape below and see it right away. Drag it to move it, tap it to change its size.')}</small></span>
          <input type="checkbox" role="switch" className="switch" checked={face} onChange={e => setFace(e.target.checked)} />
        </label>
        {face && (
          <div className="live-shapes" role="radiogroup" aria-label={t('Bubble shape')}>
            {SHAPES.map(sh => (
              <button key={sh.id} role="radio" aria-checked={shape === sh.id} className={shape === sh.id ? 'on' : ''} onClick={() => setShape(sh.id)}>
                <i className={`shape-icon face-${sh.id}`} aria-hidden="true" />
                {t(sh.label)}
              </button>
            ))}
          </div>
        )}

        <div className="import-bar">
          <span>{t('Notes people can see: {n}', { n: picked.size })}</span>
          {picked.size > 0 && <button onClick={() => setPicked(new Set())}>{t('Clear')}</button>}
        </div>
        <ul className="sheet-list import-list">
          {!notes.length && <li className="notice">{t('No notes yet.')}</li>}
          {notes.map(nt => (
            <li key={nt.id}>
              <label className="import-item">
                <input type="checkbox" checked={picked.has(nt.id)} onChange={() => toggle(nt.id)} />
                <span className="import-title">{noteTitle(nt)}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="live-actions">
          {live.on && <button onClick={onEnd}>{t('End Live mode')}</button>}
          <button className="primary" onClick={() => onStart([...picked], face, shape)}>{t(live.on ? 'Save' : 'Start Live mode')}</button>
        </div>
      </div>
    </div>
  );
}

const SIZES: BubbleSize[] = ['s', 'm', 'l'];
const POS_KEY = 'liveBubble';

/** Your camera in a circle (or the shape picked), mirrored like a selfie. Drag to move; tap to go small → medium → large. */
export function FaceBubble({ shape, onError }: { shape: BubbleShape; onError: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number; size: BubbleSize }>(() => {
    try { return { x: 16, y: 120, size: 'm', ...JSON.parse(localStorage.getItem(POS_KEY) || '{}') }; } catch { return { x: 16, y: 120, size: 'm' }; }
  });
  const drag = useRef<{ dx: number; dy: number; moved: boolean; px: number; py: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(spot)); } catch { /* fine */ }
  }, [spot]);

  useEffect(() => {
    let stream: MediaStream | null = null, stopped = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then(s => {
        if (stopped) return s.getTracks().forEach(tr => tr.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => onError(t('Couldn’t start the camera. Allow camera access for Voice Bible, then turn Show my face on again.')));
    return () => {
      stopped = true;
      stream?.getTracks().forEach(tr => tr.stop());
    };
  }, [onError]);

  // Keep it on screen when the window gets smaller
  const clamp = (x: number, y: number, el: HTMLElement | null) => {
    const w = el?.offsetWidth ?? 120, h = el?.offsetHeight ?? 120;
    return { x: Math.max(0, Math.min(window.innerWidth - w, x)), y: Math.max(0, Math.min(window.innerHeight - h, y)) };
  };
  useEffect(() => {
    const fit = () => setSpot(s => ({ ...s, ...clamp(s.x, s.y, video.current?.parentElement ?? null) }));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [spot.size, shape]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - spot.x, dy: e.clientY - spot.y, moved: false, px: e.clientX, py: e.clientY };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.px, e.clientY - d.py) > 6) d.moved = true;
    if (d.moved) setSpot(s => ({ ...s, ...clamp(e.clientX - d.dx, e.clientY - d.dy, e.currentTarget) }));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setSpot(s => ({ ...s, size: SIZES[(SIZES.indexOf(s.size) + 1) % SIZES.length] }));
  };

  return (
    <div
      className={`face-bubble face-${spot.size} face-${shape}`}
      style={{ left: spot.x, top: spot.y }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; }}
      role="img"
      aria-label={t('Your camera')}
    >
      <video ref={video} autoPlay muted playsInline />
    </div>
  );
}
