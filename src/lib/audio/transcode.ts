"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// ponytail: pin to a known version. The WASM is ~30 MB; we load it from
// unpkg lazily on first use so it never blocks page load.
const FFMPEG_CORE_VERSION = "0.12.10";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let loadProgress = 0;

type ProgressCallback = (ratio: number) => void;
let progressCb: ProgressCallback | null = null;

export function onTranscodeProgress(cb: ProgressCallback | null) {
  progressCb = cb;
}

/**
 * Load ffmpeg.wasm (single-threaded) on first use. ~30 MB total.
 * Subsequent calls return the cached instance.
 */
export async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    ff.on("log", () => {
      /* noisy in dev */
    });
    ff.on("progress", ({ progress }) => {
      loadProgress = progress;
      if (progressCb) progressCb(progress);
    });
    await ff.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  try {
    return await loadingPromise;
  } catch (e) {
    loadingPromise = null;
    throw e;
  }
}

/**
 * Transcode an audio Blob to MP3 (64 kbps mono) — the universally
 * supported format for WhatsApp voice notes. Throws on failure.
 */
export async function transcodeToMp3(input: Blob): Promise<Blob> {
  const ff = await getFfmpeg();
  const inName = "input.bin";
  const outName = "output.mp3";

  try {
    await ff.writeFile(inName, await fetchFile(input));
    // -y: overwrite output, -vn: no video, -ac 1: mono, -b:a 64k: bitrate
    await ff.exec([
      "-i", inName,
      "-vn",
      "-ac", "1",
      "-ar", "22050",
      "-c:a", "libmp3lame",
      "-b:a", "64k",
      outName,
    ]);
    const data = await ff.readFile(outName);
    let blobPart: BlobPart;
    if (data instanceof Uint8Array) {
      // ponytail: ffmpeg's WASM buffer is SharedArrayBuffer-backed; copy
      // into a fresh ArrayBuffer so Blob accepts it.
      const fresh = new ArrayBuffer(data.byteLength);
      new Uint8Array(fresh).set(data);
      blobPart = fresh;
    } else {
      blobPart = new TextEncoder().encode(String(data));
    }
    return new Blob([blobPart], { type: "audio/mpeg" });
  } finally {
    // Clean up virtual filesystem to keep memory small.
    try { await ff.deleteFile(inName); } catch {}
    try { await ff.deleteFile(outName); } catch {}
  }
}