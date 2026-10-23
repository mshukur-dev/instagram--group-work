'use client';

import { VOICE_MAX_SECONDS, VOICE_WAVEFORM_BARS } from '@instagram/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Recording = { blob: Blob; duration: number; waveform: number[] };
export type RecorderState = 'idle' | 'starting' | 'recording';

// How often the level is sampled, and how many recent levels the live strip shows
const SAMPLE_MS = 80;
const LIVE_BARS = 48;

// Opus in WebM where it exists (Chrome, Firefox), AAC in MP4 for Safari
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Bar heights 0..100: the loudest part of each slice, scaled to the loudest slice */
function toWaveform(samples: number[]): number[] {
  if (samples.length === 0) return [0];
  const bars = Math.min(VOICE_WAVEFORM_BARS, samples.length);
  const slice = samples.length / bars;
  const peaks = Array.from({ length: bars }, (_, i) =>
    Math.max(...samples.slice(Math.floor(i * slice), Math.max(Math.floor((i + 1) * slice), 1))),
  );
  const top = Math.max(...peaks, 0.05);
  return peaks.map((p) => Math.round(Math.min(1, p / top) * 100));
}

// DM voice messages: records the microphone with MediaRecorder and, through an analyser,
// measures how loud it is every 80 ms, for the live strip and the bubble's waveform.
export function useVoiceRecorder({ onLimit }: { onLimit: () => void }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0);
  const limit = useRef(onLimit);
  limit.current = onLimit;

  const release = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    void audio.current?.close().catch(() => undefined);
    stream.current = null;
    audio.current = null;
    recorder.current = null;
    setState('idle');
    setElapsed(0);
    setLevels([]);
  }, []);

  // Leaving the chat mid-recording drops it
  useEffect(() => release, [release]);

  /** Asks for the microphone and starts; throws if it is not allowed or not there */
  const start = useCallback(async () => {
    if (recorder.current) return;
    setState('starting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      samples.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current = rec;

      const ctx = new AudioContext();
      audio.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(media).connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);

      rec.start(250);
      startedAt.current = performance.now();
      setState('recording');
      timer.current = setInterval(() => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) sum += ((value - 128) / 128) ** 2;
        // RMS of speech is small; lift it so a normal voice fills most of the height
        const level = Math.min(1, Math.sqrt(sum / buffer.length) * 4);
        samples.current.push(level);
        setLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), level]);
        const seconds = (performance.now() - startedAt.current) / 1000;
        setElapsed(seconds);
        if (seconds >= VOICE_MAX_SECONDS) limit.current();
      }, SAMPLE_MS);
    } catch (error) {
      release();
      throw error;
    }
  }, [release]);

  /** Finishes the recording; null if nothing usable was recorded */
  const stop = useCallback(async (): Promise<Recording | null> => {
    const rec = recorder.current;
    if (!rec) return null;
    const duration = Math.min((performance.now() - startedAt.current) / 1000, VOICE_MAX_SECONDS);
    const waveform = toWaveform(samples.current);
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    if (rec.state !== 'inactive') rec.stop();
    await done;
    const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
    release();
    return blob.size > 0 ? { blob, duration, waveform } : null;
  }, [release]);

  const cancel = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    release();
  }, [release]);

  return { state, elapsed, levels, start, stop, cancel };
}

export const formatVoiceTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
