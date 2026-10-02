/**
 * Phone browsers record MP4 as a "fragmented" file: many small pieces, with the total length left out.
 * Android's Photos/Gallery then shows the wrong length (a 12-second video says 3 seconds) and may stop early.
 * This copies the recorded picture and sound, unchanged, into a normal MP4 with its length written at the start.
 * Anything it can't handle is returned as it was.
 */
export async function normalMp4(blob: Blob): Promise<Blob> {
  if (!blob.type.includes('mp4')) return blob;
  try {
    const [box, { Muxer, ArrayBufferTarget }] = await Promise.all([import('mp4box'), import('mp4-muxer')]);
    const MP4Box = box.default ?? box;
    const DataStream = MP4Box.DataStream;
    const buf = (await blob.arrayBuffer()) as ArrayBuffer & { fileStart: number };
    buf.fileStart = 0;
    const file = MP4Box.createFile();
    const info = await new Promise<Mp4Info>((resolve, reject) => {
      file.onReady = resolve;
      file.onError = (e: string) => reject(new Error(e));
      file.appendBuffer(buf);
      file.flush();
    });
    // Already a normal file (not in pieces): leave it alone
    if (!info.isFragmented) return blob;

    const vt = info.videoTracks[0];
    const at = info.audioTracks[0];
    // H.264 (most phones), H.265, VP9 (some Android phones) or AV1
    const vcodec = !vt ? null : /^avc[13]/.test(vt.codec) ? 'avc' : /^(hvc1|hev1)/.test(vt.codec) ? 'hevc' : /^vp09/.test(vt.codec) ? 'vp9' : /^av01/.test(vt.codec) ? 'av1' : null;
    if (!vt || !vcodec) return blob;
    const aac = at && /^mp4a/.test(at.codec);
    const opus = at && /^opus/i.test(at.codec);
    if (at && !aac && !opus) return blob;

    // The codec set-up data players need (avcC/hvcC/av1C; VP9 and Opus have theirs rebuilt by the muxer; AAC's AudioSpecificConfig)
    const entry = (id: number) => file.getTrackById(id).mdia.minf.stbl.stsd.entries[0];
    const boxBytes = (box: { write: (s: unknown) => void }) => {
      const s = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(s);
      return new Uint8Array(s.buffer, 8); // without the box's own 8-byte header
    };
    const vEntry = entry(vt.id);
    const descBox = vEntry.avcC ?? vEntry.hvcC ?? vEntry.av1C;
    const videoDesc = descBox ? boxBytes(descBox) : undefined;
    // VP9 also needs its colour details, copied from the recording (the muxer knows these values; others count as BT.709)
    const vp = vEntry.vpcC;
    const pick = <T extends string>(n: number | undefined, names: Record<number, T>, fallback: T) => (n != null && names[n]) || fallback;
    const colorSpace = vp
      ? {
          primaries: pick(vp.colourPrimaries, { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<number, 'bt709' | 'bt470bg' | 'smpte170m'>, 'bt709'),
          transfer: pick(vp.transferCharacteristics, { 1: 'bt709', 6: 'smpte170m', 13: 'iec61966-2-1' } as Record<number, 'bt709' | 'smpte170m' | 'iec61966-2-1'>, 'bt709'),
          matrix: pick(vp.matrixCoefficients, { 0: 'rgb', 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<number, 'rgb' | 'bt709' | 'bt470bg' | 'smpte170m'>, 'bt709'),
          fullRange: !!vp.videoFullRangeFlag,
        }
      : undefined;
    let audioDesc: Uint8Array | undefined;
    if (aac) {
      const dsi = entry(at.id).esds?.esd?.descs?.[0]?.descs?.[0]?.data;
      if (dsi) audioDesc = new Uint8Array(dsi);
    }

    // Read every sample of each track
    const samples = new Map<number, Mp4Sample[]>();
    file.onSamples = (id: number, _user: unknown, list: Mp4Sample[]) => {
      samples.set(id, (samples.get(id) ?? []).concat(list));
    };
    for (const tr of [vt, at].filter(Boolean)) file.setExtractionOptions(tr!.id, null, { nbSamples: 1e9 });
    file.start();
    file.flush();
    const vs = samples.get(vt.id) ?? [];
    const as = at ? samples.get(at.id) ?? [] : [];
    if (!vs.length) return blob;

    // Which way up: phones store portrait video with a rotation, which has to be kept
    const m = vt.matrix ?? [];
    const a = (m[0] ?? 65536) / 65536;
    const b = (m[1] ?? 0) / 65536;
    const deg = ((Math.round((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
    const rotation = ([0, 90, 180, 270] as const).find(r => Math.abs(r - deg) < 2) ?? 0;

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
      video: { codec: vcodec, width: vt.video.width, height: vt.video.height, rotation },
      ...(at ? { audio: { codec: aac ? ('aac' as const) : ('opus' as const), numberOfChannels: at.audio.channel_count, sampleRate: at.audio.sample_rate } } : {}),
    });
    const us = (v: number, scale: number) => Math.round((v / scale) * 1e6);
    vs.forEach((s, i) =>
      muxer.addVideoChunkRaw(
        new Uint8Array(s.data),
        s.is_sync ? 'key' : 'delta',
        us(s.dts, s.timescale),
        us(s.duration, s.timescale),
        i === 0 ? { decoderConfig: { codec: vt.codec, codedWidth: vt.video.width, codedHeight: vt.video.height, ...(videoDesc ? { description: videoDesc } : {}), ...(colorSpace ? { colorSpace } : {}) } } : undefined,
        us(s.cts - s.dts, s.timescale),
      ),
    );
    as.forEach((s, i) =>
      muxer.addAudioChunkRaw(
        new Uint8Array(s.data),
        'key',
        us(s.dts, s.timescale),
        us(s.duration, s.timescale),
        i === 0 ? { decoderConfig: { codec: at!.codec, sampleRate: at!.audio.sample_rate, numberOfChannels: at!.audio.channel_count, ...(audioDesc ? { description: audioDesc } : {}) } } : undefined,
      ),
    );
    muxer.finalize();
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (e) {
    console.warn('Couldn’t rewrite the MP4; keeping the recording as it is:', e);
    return blob;
  }
}

interface Mp4Sample { data: ArrayBuffer; dts: number; cts: number; duration: number; timescale: number; is_sync: boolean }
interface Mp4Track { id: number; codec: string; matrix?: number[]; video: { width: number; height: number }; audio: { channel_count: number; sample_rate: number } }
interface Mp4Info { isFragmented: boolean; videoTracks: Mp4Track[]; audioTracks: Mp4Track[] }
