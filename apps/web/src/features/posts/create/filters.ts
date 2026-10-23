import type { Area } from 'react-easy-crop';

// POST-8: photo filters and adjustments before publishing.
// Every look is one 4×5 color matrix (the same math as SVG feColorMatrix), plus an optional
// tinted layer with a blend mode and a vignette. The preview draws it with an SVG filter and
// two layers on top; publishing paints the very same thing onto a canvas, so what you see is
// what gets uploaded.

/** 20 numbers: rows R, G, B, A; columns r, g, b, a, offset (0..1) */
export type Matrix = number[];

export type Blend = 'overlay' | 'soft-light' | 'multiply' | 'screen' | 'darken' | 'lighten';

/** A tinted layer on top of the photo: one color, or two for a top-to-bottom gradient */
export type Overlay = { colors: [string] | [string, string]; blend: Blend };

export const FILTER_KEYS = [
  'normal',
  'clarendon',
  'gingham',
  'moon',
  'lark',
  'reyes',
  'juno',
  'slumber',
  'crema',
  'ludwig',
  'aden',
  'perpetua',
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const ADJUSTMENTS = [
  { key: 'brightness', min: -100 },
  { key: 'contrast', min: -100 },
  { key: 'fade', min: 0 },
  { key: 'saturation', min: -100 },
  { key: 'temperature', min: -100 },
  { key: 'vignette', min: 0 },
] as const;
export type AdjustmentKey = (typeof ADJUSTMENTS)[number]['key'];
export type Adjustments = Record<AdjustmentKey, number>;

export type PhotoEdit = {
  filter: FilterKey;
  /** 0..100: how strongly the filter is applied */
  strength: number;
  adjust: Adjustments;
};

export const EDIT_RESET: PhotoEdit = {
  filter: 'normal',
  strength: 100,
  adjust: { brightness: 0, contrast: 0, fade: 0, saturation: 0, temperature: 0, vignette: 0 },
};

// ───────────── Matrix math ─────────────

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** `outer` applied after `inner` */
function compose(outer: Matrix, inner: Matrix): Matrix {
  const out: Matrix = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? (outer[row * 5 + 4] ?? 0) : 0;
      for (let k = 0; k < 4; k++) sum += (outer[row * 5 + k] ?? 0) * (inner[k * 5 + col] ?? 0);
      out.push(sum);
    }
  }
  return out;
}

const chain = (...steps: Matrix[]): Matrix =>
  steps.reduce((total, step) => compose(step, total), IDENTITY);

/** A 3×3 color matrix with offsets; alpha stays as it is */
const rgb = (m: number[], offset: [number, number, number] = [0, 0, 0]): Matrix => [
  m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, 0, offset[0],
  m[3] ?? 0, m[4] ?? 0, m[5] ?? 0, 0, offset[1],
  m[6] ?? 0, m[7] ?? 0, m[8] ?? 0, 0, offset[2],
  0, 0, 0, 1, 0,
]; // prettier-ignore

const mix = (from: Matrix, to: Matrix, amount: number): Matrix =>
  from.map((value, i) => value + ((to[i] ?? 0) - value) * amount);

// The CSS filter functions, written as matrices (Filter Effects spec)
const brightness = (b: number) => rgb([b, 0, 0, 0, b, 0, 0, 0, b]);
const contrast = (c: number) => {
  const o = (1 - c) / 2;
  return rgb([c, 0, 0, 0, c, 0, 0, 0, c], [o, o, o]);
};
const saturate = (s: number) =>
  rgb([
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ]); // prettier-ignore
const sepia = (a: number) =>
  mix(IDENTITY, rgb([0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131]), a);
const hueRotate = (degrees: number) => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return rgb([
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ]); // prettier-ignore
};
/** Lifts the blacks: the washed-out film look */
const fade = (k: number) => rgb([1 - k, 0, 0, 0, 1 - k, 0, 0, 0, 1 - k], [k, k, k]);
/** Warmer (positive) or cooler (negative) */
const warmth = (w: number) => rgb([1, 0, 0, 0, 1, 0, 0, 0, 1], [w, w * 0.15, -w]);

// ───────────── The looks ─────────────

type Preset = { matrix: Matrix; overlay?: Overlay };

// Close to Instagram's classic filters (after CSSgram), tuned by eye
const PRESETS: Record<FilterKey, Preset> = {
  normal: { matrix: IDENTITY },
  clarendon: {
    matrix: chain(contrast(1.2), saturate(1.35)),
    overlay: { colors: ['rgb(127 187 227 / 0.2)'], blend: 'overlay' },
  },
  gingham: {
    matrix: chain(brightness(1.05), hueRotate(-10)),
    overlay: { colors: ['rgb(230 230 250 / 0.6)'], blend: 'soft-light' },
  },
  moon: { matrix: chain(saturate(0), contrast(1.1), brightness(1.1)) },
  lark: {
    matrix: chain(contrast(0.9), brightness(1.08), saturate(1.1)),
    overlay: { colors: ['rgb(242 242 242 / 0.25)'], blend: 'lighten' },
  },
  reyes: {
    matrix: chain(sepia(0.22), brightness(1.1), contrast(0.85), saturate(0.75)),
    overlay: { colors: ['rgb(239 205 173 / 0.5)'], blend: 'soft-light' },
  },
  juno: {
    matrix: chain(sepia(0.2), contrast(1.15), brightness(1.1), saturate(1.5)),
    overlay: { colors: ['rgb(127 187 227 / 0.15)'], blend: 'overlay' },
  },
  slumber: {
    matrix: chain(saturate(0.66), brightness(1.05)),
    overlay: { colors: ['rgb(125 105 24 / 0.5)'], blend: 'soft-light' },
  },
  crema: {
    matrix: chain(sepia(0.5), contrast(1.25), brightness(1.15), saturate(0.9), hueRotate(-2)),
    overlay: { colors: ['rgb(125 105 24 / 0.2)'], blend: 'multiply' },
  },
  ludwig: {
    matrix: chain(contrast(1.05), brightness(1.05), saturate(1.4)),
    overlay: { colors: ['rgb(125 105 24 / 0.1)'], blend: 'soft-light' },
  },
  aden: {
    matrix: chain(hueRotate(-20), contrast(0.9), saturate(0.85), brightness(1.2)),
    overlay: { colors: ['rgb(66 10 14 / 0.2)'], blend: 'darken' },
  },
  perpetua: {
    matrix: chain(contrast(1.05), saturate(1.1)),
    overlay: { colors: ['rgb(0 91 154 / 0.5)', 'rgb(230 193 61 / 0.5)'], blend: 'soft-light' },
  },
};

const adjustmentMatrix = (a: Adjustments): Matrix =>
  chain(
    brightness(1 + (a.brightness / 100) * 0.35),
    contrast(1 + (a.contrast / 100) * 0.45),
    saturate(1 + a.saturation / 100),
    warmth((a.temperature / 100) * 0.09),
    fade((a.fade / 100) * 0.22),
  );

/** Everything a photo's edit draws, ready for the preview and for the canvas */
export type EditLook = {
  matrix: Matrix;
  overlay: Overlay | null;
  /** 0..1 */
  overlayOpacity: number;
  /** 0..1, darkness at the corners */
  vignette: number;
};

export function editLook(edit: PhotoEdit): EditLook {
  const preset = PRESETS[edit.filter];
  const amount = edit.filter === 'normal' ? 0 : edit.strength / 100;
  return {
    matrix: compose(adjustmentMatrix(edit.adjust), mix(IDENTITY, preset.matrix, amount)),
    overlay: preset.overlay ?? null,
    overlayOpacity: amount,
    vignette: (edit.adjust.vignette / 100) * 0.7,
  };
}

/** The look of a filter on its own, for its thumbnail */
export const presetLook = (filter: FilterKey): EditLook => editLook({ ...EDIT_RESET, filter });

export const isEdited = (edit: PhotoEdit) =>
  (edit.filter !== 'normal' && edit.strength > 0) ||
  Object.values(edit.adjust).some((value) => value !== 0);

/** CSS background of the tinted layer */
export const overlayBackground = (overlay: Overlay) =>
  overlay.colors.length === 2
    ? `linear-gradient(to bottom, ${overlay.colors[0]}, ${overlay.colors[1]})`
    : overlay.colors[0];

// The vignette starts this far from the center (share of the distance to a corner)
export const VIGNETTE_START = 0.45;
export const vignetteBackground = (darkness: number) =>
  `radial-gradient(circle farthest-corner at center, transparent ${VIGNETTE_START * 100}%, rgb(0 0 0 / ${darkness}) 100%)`;

// ───────────── Painting it for real ─────────────

// The long side of an edited photo; Instagram itself keeps 1080 px
const MAX_SIDE = 2160;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = url;
  });
}

/** Draws `look` over what is already on the canvas (the photo, cropped) */
function paintLook(ctx: CanvasRenderingContext2D, width: number, height: number, look: EditLook) {
  const pixels = ctx.getImageData(0, 0, width, height);
  const d = pixels.data;
  const m = look.matrix.map((value, i) => (i % 5 === 4 ? value * 255 : value));
  const [m0, m1, m2, , m4, m5, m6, m7, , m9, m10, m11, m12, , m14] = m as [
    number, number, number, number, number, number, number, number,
    number, number, number, number, number, number, number,
  ]; // prettier-ignore
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    // Uint8ClampedArray rounds and clamps by itself
    d[i] = m0 * r + m1 * g + m2 * b + m4;
    d[i + 1] = m5 * r + m6 * g + m7 * b + m9;
    d[i + 2] = m10 * r + m11 * g + m12 * b + m14;
  }
  ctx.putImageData(pixels, 0, 0);

  if (look.overlay && look.overlayOpacity > 0) {
    const [top, bottom] = look.overlay.colors;
    let fill: string | CanvasGradient = top;
    if (bottom) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      fill = gradient;
    }
    ctx.globalCompositeOperation = look.overlay.blend;
    ctx.globalAlpha = look.overlayOpacity;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  if (look.vignette > 0) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.hypot(cx, cy);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(VIGNETTE_START, 'rgb(0 0 0 / 0)');
    gradient.addColorStop(1, `rgb(0 0 0 / ${look.vignette})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

/** The cropped photo with its edit painted in, as a JPEG ready for upload */
export async function bakeEdit(
  url: string,
  area: Area,
  edit: PhotoEdit,
  name: string,
): Promise<File> {
  const image = await loadImage(url);
  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const width = Math.max(1, Math.round(area.width * scale));
  const height = Math.max(1, Math.round(area.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  // A transparent PNG would turn black in a JPEG
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
  paintLook(ctx, width, height, editLook(edit));

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('canvas');
  return new File([blob], `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, {
    type: 'image/jpeg',
  });
}

/** A small square of the cropped photo, for the filter thumbnails */
export async function thumbnail(url: string, area: Area, size = 160): Promise<string> {
  const image = await loadImage(url);
  const side = Math.min(area.width, area.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    area.x + (area.width - side) / 2,
    area.y + (area.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL('image/jpeg', 0.85);
}
