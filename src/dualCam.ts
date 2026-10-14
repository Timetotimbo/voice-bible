/**
 * Both cameras: the back camera (what you're showing) and the front camera (you), drawn together onto one
 * upright 1080×1920 picture that's recorded like the camera. Either split in half (back camera on top, you
 * underneath) or the back camera filling the screen with you in a round bubble.
 *
 * Many phones can't run both cameras at once from a browser. Then it uses one at a time, and ⟲ switches
 * between them while recording, in the same video.
 */
import { bubbleSpot, hiddenVideo, ticker, type Corner, type BubbleSize } from './screenFace';

export type DualLook = 'split' | 'bubble';
export type DualLayout = { look: DualLook; corner: Corner; size: BubbleSize };

const W = 1080, H = 1920, FPS = 30;

export type DualCam = {
  canvas: HTMLCanvasElement;
  /** The picture plus your microphone. */
  stream: MediaStream;
  /** True when both cameras run at once; false when it's one at a time. */
  both: boolean;
  setLayout: (layout: DualLayout) => void;
  /** Both at once: swaps which camera is big (top). One at a time: switches to the other camera. */
  swap: () => Promise<void>;
  stop: () => void;
};

const SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } };
const idOf = (s: MediaStream) => s.getVideoTracks()[0]?.getSettings().deviceId ?? '';
/** Opens the camera facing that way; where cameras don't say which way they face, any camera other than `notId`. */
async function openCamera(facing: 'user' | 'environment', notId = '') {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, ...SIZE }, audio: false });
  } catch (e) {
    if ((e as Error).name !== 'OverconstrainedError') throw e;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId !== notId);
    if (!cams.length) throw e;
    return navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cams[0].deviceId }, ...SIZE }, audio: false });
  }
}

/** Draws `v` to fill the box (cropping what doesn't fit), mirrored for the front camera. */
function cover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number, mirror: boolean) {
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return;
  const k = Math.max(w / vw, h / vh), sw = w / k, sh = h / k;
  ctx.save();
  if (mirror) {
    ctx.translate(x * 2 + w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

/**
 * `camera` is the teleprompter's own camera and microphone (facing `facing`); the other camera is opened next to it.
 * If the phone won't run both, `camera`'s picture is used alone, and swap() changes camera.
 */
export async function startDualCam(camera: MediaStream, facing: 'user' | 'environment', layout: DualLayout): Promise<DualCam> {
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  if (cams.length < 2) throw new Error('only-one-camera');
  const other: 'user' | 'environment' = facing === 'user' ? 'environment' : 'user';
  const mic = camera.getAudioTracks();
  let mine = new MediaStream(camera.getVideoTracks()); // the teleprompter's camera
  let second: MediaStream | null = null;
  try {
    second = await openCamera(other, idOf(mine));
    // Some phones give the second camera by quietly stopping the first
    await new Promise(r => setTimeout(r, 600));
    const firstLive = mine.getVideoTracks().some(tr => tr.readyState === 'live');
    const secondLive = second.getVideoTracks().some(tr => tr.readyState === 'live');
    if (!firstLive || !secondLive) throw new Error('not both');
  } catch {
    second?.getTracks().forEach(tr => tr.stop());
    second = null;
  }
  const both = !!second;
  // One at a time, the teleprompter's own camera may have been stopped by the attempt: open it again
  const owned: MediaStream[] = second ? [second] : []; // cameras opened here (stopped here)
  if (!both && !mine.getVideoTracks().some(tr => tr.readyState === 'live')) {
    mine = await openCamera(facing, '');
    owned.push(mine);
  }

  let backVideo = hiddenVideo(facing === 'environment' ? mine : second ?? mine);
  let frontVideo = second ? hiddenVideo(facing === 'user' ? mine : second) : null;
  let soloFacing = facing; // one at a time: the camera in use
  let backOnTop = true; // both at once: which one is big

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  let current = layout;

  const draw = () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!both) {
      cover(ctx, backVideo, 0, 0, W, H, soloFacing === 'user');
      return;
    }
    const big = backOnTop ? backVideo : frontVideo!, small = backOnTop ? frontVideo! : backVideo;
    const bigMirror = big === frontVideo, smallMirror = small === frontVideo;
    if (current.look === 'split') {
      cover(ctx, big, 0, 0, W, H / 2, bigMirror);
      cover(ctx, small, 0, H / 2, W, H / 2, smallMirror);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, H / 2 - 3, W, 6);
      return;
    }
    cover(ctx, big, 0, 0, W, H, bigMirror);
    const { x, y, d } = bubbleSpot(W, H, current);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, d / 2, 0, Math.PI * 2);
    ctx.clip();
    cover(ctx, small, x - d / 2, y - d / 2, d, d, smallMirror);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, d / 2, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, d * 0.025);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  };
  draw();
  const stopTicker = ticker(FPS, draw);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...mic]);

  return {
    canvas,
    stream,
    both,
    setLayout: l => {
      current = l;
      draw();
    },
    swap: async () => {
      if (both) {
        backOnTop = !backOnTop;
        return;
      }
      // One at a time: let go of this camera, then open the other (the picture holds its last frame meanwhile)
      const next: 'user' | 'environment' = soloFacing === 'user' ? 'environment' : 'user';
      const was = backVideo.srcObject as MediaStream, wasId = idOf(was);
      was.getVideoTracks().forEach(tr => tr.stop());
      try {
        const s = await openCamera(next, wasId);
        owned.push(s);
        backVideo.remove();
        backVideo = hiddenVideo(s);
        soloFacing = next;
      } catch {
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: wasId }, ...SIZE }, audio: false }); // couldn't: back to the one it was on
        owned.push(s);
        backVideo.remove();
        backVideo = hiddenVideo(s);
      }
    },
    stop: () => {
      stopTicker();
      owned.forEach(s => s.getTracks().forEach(tr => tr.stop()));
      stream.getVideoTracks().forEach(tr => tr.stop());
      backVideo.remove();
      frontVideo?.remove();
      frontVideo = null;
    },
  };
}
