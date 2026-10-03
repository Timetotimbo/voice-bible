/**
 * Screen + face: your screen with your camera in a round bubble in one corner, drawn onto a canvas that is
 * recorded like the camera. Only computers can share their screen from a browser (not Android or iPhone).
 *
 * While you record, this page is usually behind the window you're showing, and browsers slow down hidden
 * pages' timers and animation frames. A Web Worker's timer keeps ticking, so it drives the drawing.
 */
export type Corner = 'br' | 'bl' | 'tr' | 'tl';
export type BubbleSize = 's' | 'm' | 'l';
export type Layout = { corner: Corner; size: BubbleSize; mirror: boolean };

const BUBBLE: Record<BubbleSize, number> = { s: 0.22, m: 0.3, l: 0.4 }; // of the video's height
const FPS = 30;
const MAX_SIDE = 1920;

export function canRecordScreen(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** Where the bubble goes on a w×h picture: its centre and diameter. */
export function bubbleSpot(w: number, h: number, layout: Pick<Layout, 'corner' | 'size'>) {
  const d = Math.round(Math.min(w, h) * BUBBLE[layout.size]);
  const m = Math.round(Math.min(w, h) * 0.035);
  const x = layout.corner.endsWith('l') ? m + d / 2 : w - m - d / 2;
  const y = layout.corner.startsWith('t') ? m + d / 2 : h - m - d / 2;
  return { x, y, d };
}

/** The recording size: the screen's own size, at most 1920 on its long side, in even numbers (video encoders need them). */
export function outputSize(w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h, 1));
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { w: even(w), h: even(h) };
}

export function hiddenVideo(stream: MediaStream) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  // Kept in the page (invisible): some browsers stop updating videos that aren't
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(v);
  v.play().catch(() => {});
  return v;
}

/** Calls onTick fps times a second, even while the page is hidden (a Worker's timer isn't slowed down). */
export function ticker(fps: number, onTick: () => void) {
  const src = `let iv;onmessage=e=>{clearInterval(iv);if(e.data)iv=setInterval(()=>postMessage(0),e.data)}`;
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const w = new Worker(url);
  w.onmessage = onTick;
  w.postMessage(1000 / fps);
  return () => {
    w.postMessage(0);
    w.terminate();
    URL.revokeObjectURL(url);
  };
}

export type ScreenFace = {
  canvas: HTMLCanvasElement;
  /** The picture plus your microphone (and the computer's sound, if you chose to share it). */
  stream: MediaStream;
  setLayout: (layout: Layout) => void;
  /** Called when sharing stops from the browser's own "Stop sharing" bar. */
  onEnded: (fn: () => void) => void;
  stop: () => void;
};

/** Ask which screen, window or tab to share, then start drawing it with the camera bubble. */
export async function startScreenFace(camera: MediaStream, layout: Layout): Promise<ScreenFace> {
  const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: FPS }, audio: true });
  const screenTrack = screen.getVideoTracks()[0];
  const screenVideo = hiddenVideo(screen);
  const camVideo = hiddenVideo(new MediaStream(camera.getVideoTracks()));

  const canvas = document.createElement('canvas');
  const s = screenTrack.getSettings();
  const size = outputSize(s.width || 1280, s.height || 720);
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d')!;
  let current = layout;

  const draw = () => {
    // A window can be resized while it's shared: follow its shape
    const vw = screenVideo.videoWidth, vh = screenVideo.videoHeight;
    if (vw && vh) {
      const want = outputSize(vw, vh);
      if (want.w !== canvas.width || want.h !== canvas.height) {
        canvas.width = want.w;
        canvas.height = want.h;
      }
    }
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (vw && vh) ctx.drawImage(screenVideo, 0, 0, W, H);

    const cw = camVideo.videoWidth, ch = camVideo.videoHeight;
    if (!cw || !ch) return;
    const { x, y, d } = bubbleSpot(W, H, current);
    const side = Math.min(cw, ch); // the middle square of the camera picture
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, d / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (current.mirror) {
      ctx.translate(x * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(camVideo, (cw - side) / 2, (ch - side) / 2, side, side, x - d / 2, y - d / 2, d, d);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, d / 2, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, d * 0.025);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  };
  draw();
  const stopTicker = ticker(FPS, draw);

  // Sound: the microphone, mixed with the computer's sound when it was shared too
  const mic = camera.getAudioTracks();
  const shared = screen.getAudioTracks();
  let audioTracks = mic;
  let audio: AudioContext | null = null;
  if (shared.length) {
    audio = new AudioContext();
    const out = audio.createMediaStreamDestination();
    if (mic.length) audio.createMediaStreamSource(new MediaStream(mic)).connect(out);
    audio.createMediaStreamSource(new MediaStream(shared)).connect(out);
    audioTracks = out.stream.getAudioTracks();
  }
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...audioTracks]);

  let ended: (() => void) | null = null;
  screenTrack.addEventListener('ended', () => ended?.());

  return {
    canvas,
    stream,
    setLayout: l => {
      current = l;
      draw();
    },
    onEnded: fn => {
      ended = fn;
    },
    stop: () => {
      stopTicker();
      screen.getTracks().forEach(tr => tr.stop());
      stream.getVideoTracks().forEach(tr => tr.stop());
      audio?.close().catch(() => {});
      screenVideo.remove();
      camVideo.remove();
    },
  };
}

/**
 * A small window that floats above every other window (Chrome and Edge on computers): your camera, the time and
 * a Stop button, so you can stop without coming back to this tab. Returns null where it isn't available.
 */
export async function openFloatingControls(camera: MediaStream, labels: { stop: string }, onStop: () => void) {
  const dpip = (window as Window & { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
  if (!dpip) return null;
  let win: Window;
  try {
    win = await dpip.requestWindow({ width: 240, height: 300 });
  } catch {
    return null;
  }
  const doc = win.document;
  doc.body.style.cssText = 'margin:0;background:#111;color:#fff;font:600 15px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100vh';
  const v = doc.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.srcObject = new MediaStream(camera.getVideoTracks());
  v.style.cssText = 'width:150px;height:150px;border-radius:50%;object-fit:cover;transform:scaleX(-1);border:3px solid #fff';
  const time = doc.createElement('div');
  time.textContent = '● 0:00';
  time.style.color = '#ff5a5a';
  const stop = doc.createElement('button');
  stop.textContent = labels.stop;
  stop.style.cssText = 'font:inherit;padding:8px 18px;border-radius:999px;border:0;background:#e5484d;color:#fff;cursor:pointer';
  stop.onclick = onStop;
  doc.body.append(v, time, stop);
  v.play().catch(() => {});
  const t0 = Date.now();
  const iv = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    time.textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  win.addEventListener('pagehide', () => clearInterval(iv));
  return {
    close: () => {
      clearInterval(iv);
      win.close();
    },
  };
}
