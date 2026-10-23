// Call sounds made with Web Audio, so there are no sound files to ship. Each start* returns
// a function that stops the sound. If the browser blocks audio (no click yet), they stay silent.

type Stop = () => void;

function withContext(play: (ctx: AudioContext, at: number) => number): Stop {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return () => undefined;
  }
  let timer: ReturnType<typeof setTimeout>;
  const loop = () => {
    const length = play(ctx, ctx.currentTime + 0.05);
    timer = setTimeout(loop, length * 1000);
  };
  void ctx.resume().catch(() => undefined);
  loop();
  return () => {
    clearTimeout(timer);
    void ctx.close().catch(() => undefined);
  };
}

function note(ctx: AudioContext, freq: number, at: number, length: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** Incoming call: a soft rising marimba-like phrase, twice, then a pause */
export const startRingtone = (): Stop =>
  withContext((ctx, at) => {
    const phrase = [659.25, 830.61, 987.77, 1318.51];
    for (let r = 0; r < 2; r++) {
      phrase.forEach((f, i) => note(ctx, f, at + r * 0.75 + i * 0.13, 0.5, 0.18));
    }
    return 3;
  });

/** Calling someone: the classic ring-back, two tones together, 2 s on, 4 s off */
export const startRingback = (): Stop =>
  withContext((ctx, at) => {
    [440, 480].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.05, at + 0.05);
      gain.gain.setValueAtTime(0.05, at + 1.95);
      gain.gain.linearRampToValueAtTime(0, at + 2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 2.05);
    });
    return 6;
  });

/** Call ended: two short falling beeps */
export function playHangup() {
  const stop = withContext((ctx, at) => {
    note(ctx, 620, at, 0.18, 0.12);
    note(ctx, 470, at + 0.2, 0.25, 0.12);
    return 10;
  });
  setTimeout(stop, 700);
}
