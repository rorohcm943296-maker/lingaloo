// OCR language list: Tesseract code → our app language code + display
// For CJK scripts we append "+eng" so English/roman text mixed in is also read.

export const OCR_LANGUAGES = [
  { tess: "jpn", app: "ja", name: "日本語", flag: "🇯🇵" },
  { tess: "chi_sim", app: "zh", name: "中文 (简体)", flag: "🇨🇳" },
  { tess: "chi_tra", app: "zh", name: "中文 (繁體)", flag: "🇹🇼" },
  { tess: "kor", app: "ko", name: "한국어", flag: "🇰🇷" },
  { tess: "eng", app: "en", name: "English", flag: "🇬🇧" },
  { tess: "spa", app: "es", name: "Español", flag: "🇪🇸" },
  { tess: "fra", app: "fr", name: "Français", flag: "🇫🇷" },
  { tess: "deu", app: "de", name: "Deutsch", flag: "🇩🇪" },
  { tess: "ita", app: "it", name: "Italiano", flag: "🇮🇹" },
  { tess: "por", app: "pt", name: "Português", flag: "🇵🇹" },
  { tess: "rus", app: "ru", name: "Русский", flag: "🇷🇺" },
  { tess: "ara", app: "ar", name: "العربية", flag: "🇸🇦" },
  { tess: "hin", app: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { tess: "tha", app: "th", name: "ไทย", flag: "🇹🇭" },
  { tess: "vie", app: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
];

// Scripts that don't share the Latin alphabet → need CJK space-joining,
// and a post-OCR script filter so only the selected language's text is kept.
const CJK = new Set(["jpn", "chi_sim", "chi_tra", "kor"]);

// Unique script ranges for filtering non-target-language text after OCR.
// For each language we keep lines that contain ANY character from the expected
// script family — not just the "unique" script. So Japanese keeps kana AND
// kanji (not just kana), Korean keeps Hangul, etc.
// The language selector's job is to drop clearly foreign scripts (e.g. English
// lines in a Japanese scan), not to drop legitimate characters of the target
// language (like kanji in Japanese text).
const LANG_FILTERS = {
  jpn:      { ranges: [[0x3040,0x309F],[0x30A0,0x30FF],[0x4E00,0x9FFF]], desc: "kana/kanji" },
  chi_sim:  { ranges: [[0x4E00,0x9FFF]],                                   desc: "CJK ideographs" },
  chi_tra:  { ranges: [[0x4E00,0x9FFF]],                                   desc: "CJK ideographs" },
  kor:      { ranges: [[0xAC00,0xD7AF]],                                   desc: "Hangul" },
};

// Tesseract inserts spaces between CJK characters ("こん に ち は").
// Join them back into words ("こんにちは") while preserving Latin/English words.
// Uses a lookahead so consecutive joins chain ("日 本 語" → "日本語"), and
// [ \t] instead of \s so lines are never merged across newlines.
function joinCJK(text) {
  return text.replace(
    /([\u3040-\u30ff\u4e00-\u9fff])[ \t]+(?=[\u3040-\u30ff\u4e00-\u9fff])/g,
    "$1"
  );
}

import { createWorker } from "tesseract.js";

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not load image"));
    };
    img.src = url;
  });
}

// Separable Gaussian blur on a Uint8ClampedArray grayscale buffer.
function gaussianBlur(src, w, h, radius) {
  const dst = new Uint8ClampedArray(src.length);
  // build 1D kernel
  const sigma = radius;
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;

  const tmp = new Uint8ClampedArray(src.length);

  // horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        acc += src[y * w + xx] * kernel[k + radius];
      }
      tmp[y * w + x] = acc;
    }
  }
  // vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        acc += tmp[yy * w + x] * kernel[k + radius];
      }
      dst[y * w + x] = acc;
    }
  }
  return dst;
}

// Otsu's method — find the threshold that best separates text from background.
function otsuThreshold(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

// Preprocess a photo for OCR: crop (optional) → upscale → grayscale → light contrast.
// We deliberately do NOT apply our own binarization — Tesseract has a better
// internal adaptive threshold, and a global Otsu on a real photo (shadows,
// uneven light) picks a bad threshold and produces garbage.
async function preprocessImage(file, screenMode, isCJK, crop) {
  const img = await loadImage(file);

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  // source rect (crop) in natural pixels — defaults to the whole image
  let sx = 0, sy = 0, sw = natW, sh = natH;
  if (crop && crop.w > 0 && crop.h > 0) {
    sx = Math.max(0, Math.round(crop.x));
    sy = Math.max(0, Math.round(crop.y));
    sw = Math.min(natW - sx, Math.round(crop.w));
    sh = Math.min(natH - sy, Math.round(crop.h));
  }

  // CJK text needs larger characters for accuracy — upscale the (cropped) region.
  const target = isCJK ? 3000 : 1400;
  const scale = Math.max(1, Math.round(target / sw));
  const w = sw * scale;
  const h = sh * scale;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false; // nearest-neighbor: preserves sharp text edges
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const N = w * h;

  // 1. grayscale + light contrast boost (darkens text, lightens background)
  const gray = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    const g = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    gray[i] = Math.max(0, Math.min(255, g + (g - 128) * 0.4));
  }

  // 2. only for screen photos: very light blur to reduce moiré
  //    for paper: apply unsharp mask to sharpen fine strokes
  if (screenMode) {
    const blurred = gaussianBlur(gray, w, h, 1);
    for (let i = 0; i < N; i++) {
      const p = i * 4;
      d[p] = d[p + 1] = d[p + 2] = blurred[i];
    }
  } else {
    // Unsharp mask: output = gray + amount * (gray - blurred)
    const amount = 1.2;
    const blurred = gaussianBlur(gray, w, h, 1);
    for (let i = 0; i < N; i++) {
      const p = i * 4;
      const edge = gray[i] - blurred[i];
      const val = Math.max(0, Math.min(255, gray[i] + amount * edge));
      d[p] = d[p + 1] = d[p + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * OCR: image File → recognized text.
 * @returns {{ text: string }}
 */
export async function recognizeImage(file, tessCode, onProgress, opts = {}) {
  const isCJK = CJK.has(tessCode);
  const canvas = await preprocessImage(file, opts.screen, isCJK, opts.crop);

  const data = await runOcrPass(canvas, tessCode, onProgress);

  let text = data.text || "";
  // Only join CJK spaces — do NOT filter/strip characters.
  // Real photos cause tesseract to output Latin characters for Japanese text;
  // stripping them destroys the output. User can manually edit the textarea.
  if (isCJK) {
    text = joinCJK(text);
  }
  return { text: text.trim() };
}

async function runOcrPass(canvas, lang, onProgress) {
  const worker = await createWorker(lang, 1, {
    gzip: true,
    logger: (m) => {
      if (onProgress && m.status === "loading language traineddata") {
        onProgress(m.progress, "Loading language data…");
      }
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data;
  } finally {
    await worker.terminate();
  }
}

// Strip every character that doesn't belong to the selected language's script.
// Individual characters are kept or removed, so a line like "これは English です"
// becomes "これは です" — the English is stripped at the character level.
function filterByLanguage(text, tessCode) {
  const filter = LANG_FILTERS[tessCode];
  if (!filter) return text;

  const ranges = filter.ranges;
  let out = "";

  for (const ch of text) {
    // always preserve whitespace structure
    if (ch === "\n" || ch === " " || ch === "\t") {
      out += ch;
      continue;
    }
    const code = ch.codePointAt(0);
    if (ranges.some(([lo, hi]) => code >= lo && code <= hi)) {
      out += ch;
    }
    // else: non-target character → stripped
  }

  // collapse runs of spaces left by stripping
  out = out.replace(/ {2,}/g, " ");

  // remove empty lines and leading/trailing whitespace per line
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}
