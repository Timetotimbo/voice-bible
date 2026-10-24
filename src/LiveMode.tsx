import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { t } from './i18n';
import { noteTitle, type Note } from './useNotes';

/**
 * Live mode, for teaching on a livestream with a camera pointed at the screen: only the notes you pick show
 * anywhere in the app, and your face can sit in a round camera bubble that stays over every screen.
 * Remembered on this device, so a reload in the middle of a live doesn't show every note again.
 */
// presentFace: whether the bubble stays on while verses are presented full screen (📷 in Present)
// zoom: how far the camera is zoomed in on your face, so less of the room behind shows
// clean: the pointer and the app's buttons fade away when the mouse or a finger has been still for a few seconds
// aim: where a zoom centres (0 top … 100 bottom of the camera picture); ring: the bubble's edge colour
export type Live = { on: boolean; shown: string[]; face: boolean; shape: BubbleShape; zoom: number; aim: number; ring: string; presentFace: boolean; clean: boolean };
type BubbleSize = 'xs' | 's' | 'm' | 'l';
/** Round, a narrower oval, or a circle with its top or bottom third cut off flat, to show less of the room */
export type BubbleShape = 'round' | 'narrow' | 'cut-top' | 'cut-bottom';

const KEY = 'liveMode';
const OFF: Live = { on: false, shown: [], face: true, shape: 'round', zoom: 1, aim: 50, ring: 'purple', presentFace: true, clean: true };
const ZOOMS = [1, 1.5, 2, 2.5];
export type FaceLook = { face: boolean; shape: BubbleShape; zoom: number; aim: number; ring: string };
const AIMS = [{ at: 30, label: '▲ Higher' }, { at: 50, label: '● Middle' }, { at: 70, label: '▼ Lower' }];
// The bubble's edge: the app's purple, white, gold, or none at all
export const RINGS: Record<string, string> = { purple: 'var(--purple-bright)', white: '#fff', gold: '#f5c542', none: 'transparent' };
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
  onStart: (shown: string[], look: FaceLook, clean: boolean) => void;
  onEnd: () => void;
  onClose: () => void;
  onPreview: (draft: FaceLook) => void; // shows the bubble as picked, before Save
}) {
  const [picked, setPicked] = useState(() => new Set(live.shown.filter(id => notes.some(n => n.id === id))));
  const [face, setFace] = useState(live.face);
  const [shape, setShape] = useState(live.shape);
  const [zoom, setZoom] = useState(live.zoom);
  const [aim, setAim] = useState(live.aim);
  const [ring, setRing] = useState(live.ring);
  const [clean, setClean] = useState(live.clean);
  useEffect(() => onPreview({ face, shape, zoom, aim, ring }), [face, shape, zoom, aim, ring, onPreview]);
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
        {face && (
          <div className="live-zoom" role="radiogroup" aria-label={t('Zoom in on my face')}>
            <span>{t('Zoom in on my face')}</span>
            {ZOOMS.map(z => (
              <button key={z} role="radio" aria-checked={zoom === z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
                {`${z}×`}
              </button>
            ))}
          </div>
        )}

        {face && zoom > 1 && (
          <div className="live-zoom" role="radiogroup" aria-label={t('Aim the zoom')}>
            <span>{t('Aim the zoom')}</span>
            {AIMS.map(a => (
              <button key={a.at} role="radio" aria-checked={aim === a.at} className={aim === a.at ? 'on' : ''} onClick={() => setAim(a.at)}>{t(a.label)}</button>
            ))}
          </div>
        )}
        {face && (
          <div className="live-zoom" role="radiogroup" aria-label={t('Edge colour')}>
            <span>{t('Edge colour')}</span>
            {Object.entries(RINGS).map(([id, c]) => (
              <button key={id} role="radio" aria-checked={ring === id} aria-label={t(id)} title={t(id)} className={`ring-pick${ring === id ? ' on' : ''}`} onClick={() => setRing(id)}>
                <i style={{ borderColor: id === 'none' ? 'var(--muted)' : c, borderStyle: id === 'none' ? 'dashed' : 'solid' }} />
              </button>
            ))}
          </div>
        )}
        <label className="set-row">
          <span>{t('Clean screen')}<small className="set-sub">{t('When the mouse or your finger is still for a few seconds, the pointer, the tab bar and the app’s buttons fade away, so people see only what you’re teaching. Move or tap to bring them back.')}</small></span>
          <input type="checkbox" role="switch" className="switch" checked={clean} onChange={e => setClean(e.target.checked)} />
        </label>

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
          <button className="primary" onClick={() => onStart([...picked], { face, shape, zoom, aim, ring }, clean)}>{t(live.on ? 'Save' : 'Start Live mode')}</button>
        </div>
      </div>
    </div>
  );
}

const SIZES: BubbleSize[] = ['xs', 's', 'm', 'l'];
const POS_KEY = 'liveBubble';

/** Your camera in a circle (or the shape picked), mirrored like a selfie. Drag to move; tap to go extra small → small → medium → large. */
export function FaceBubble({ shape, zoom, aim, ring, onError }: { shape: BubbleShape; zoom: number; aim: number; ring: string; onError: (text: string) => void }) {
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
      style={{ left: spot.x, top: spot.y, borderColor: RINGS[ring] ?? RINGS.purple }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; }}
      role="img"
      aria-label={t('Your camera')}
    >
      <video ref={video} autoPlay muted playsInline style={{ transform: `scale(${-zoom}, ${zoom})`, transformOrigin: `50% ${aim}%` }} />
    </div>
  );
}
