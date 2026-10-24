import type { ImageSegmenter } from '@mediapipe/tasks-vision';

/**
 * The face bubble's background: blurred, or blacked out, behind you. MediaPipe's selfie segmenter finds the person
 * in each camera frame; everything else is drawn blurred (or dark) on a canvas shown in place of the video. Its
 * engine (about 9 MB) and model (250 KB) load from their CDNs the first time it's turned on, then the browser
 * keeps them.
 */
export type Backdrop = 'none' | 'blur' | 'dark';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let loading: Promise<ImageSegmenter> | null = null;
function segmenter(): Promise<ImageSegmenter> {
  loading ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    return make('GPU').catch(() => make('CPU'));
  })().catch(e => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Draws the video onto the canvas with its background blurred or dark, every frame, until the returned stop(). */
export function drawBackdrop(video: HTMLVideoElement, canvas: HTMLCanvasElement, mode: Exclude<Backdrop, 'none'>, onFail: () => void): () => void {
  let stopped = false, frame = 0, last = -1;
  const out = canvas.getContext('2d')!;
  const person = document.createElement('canvas'), pctx = person.getContext('2d')!;
  const mask = document.createElement('canvas'), mctx = mask.getContext('2d')!;
  let pixels: ImageData | null = null;

  segmenter().then(seg => {
    const step = () => {
      if (stopped) return;
      frame = requestAnimationFrame(step);
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || video.readyState < 2 || video.currentTime === last) return;
      last = video.currentTime;
      // A small canvas is plenty for a bubble, and keeps it quick on a phone
      const scale = Math.min(1, 360 / Math.max(w, h));
      const cw = Math.round(w * scale), ch = Math.round(h * scale);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      if (person.width !== cw || person.height !== ch) {
        person.width = cw;
        person.height = ch;
      }
      const result = seg.segmentForVideo(video, performance.now());
      const conf = result.confidenceMasks?.[0];
      if (!conf) return result.close();
      const mw = conf.width, mh = conf.height, values = conf.getAsFloat32Array();
      if (mask.width !== mw || mask.height !== mh || !pixels) {
        mask.width = mw;
        mask.height = mh;
        pixels = mctx.createImageData(mw, mh);
      }
      const px = pixels.data;
      for (let i = 0; i < values.length; i++) px[i * 4 + 3] = values[i] * 255;
      result.close();
      mctx.putImageData(pixels, 0, 0);

      // You: the frame, kept only where the mask says there's a person (its soft edge blends in)
      pctx.globalCompositeOperation = 'source-over';
      pctx.drawImage(video, 0, 0, cw, ch);
      pctx.globalCompositeOperation = 'destination-in';
      pctx.filter = 'blur(2px)';
      pctx.drawImage(mask, 0, 0, cw, ch);
      pctx.filter = 'none';

      // Behind you: the frame blurred, or dark
      if (mode === 'blur') {
        out.filter = 'blur(16px)';
        out.drawImage(video, -16, -16, cw + 32, ch + 32); // a little bigger, so the blur doesn't fade at the edges
        out.filter = 'none';
      } else {
        out.fillStyle = '#0b0b10';
        out.fillRect(0, 0, cw, ch);
      }
      out.drawImage(person, 0, 0);
    };
    step();
  }, () => {
    if (!stopped) onFail();
  });

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
  };
}
