import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { createCanvas } from "canvas";

const FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf";
const TEXT = "深さを尋ねけり";

// Simulate the app's pipeline: load image → draw to canvas with smoothing → read back
async function simulate(smoothing, quality) {
  // render SVG at 24px on 900px canvas
  const svg = `<svg width="900" height="60" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="5" y="40" font-family="IPAGothic" font-size="24" fill="black">${TEXT}</text></svg>`;
  const svgBuf = await sharp(Buffer.from(svg)).blur(0.6).png().toBuffer();

  // load as image (via sharp to pixels)
  const { data: src, info } = await sharp(svgBuf).raw().toBuffer({ resolveWithObject: true });

  // target canvas: 3000 wide
  const tw = 3000, th = Math.round(3000 * info.height / info.width);
  const c = createCanvas(tw, th);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = smoothing;
  if (smoothing && quality) ctx.imageSmoothingQuality = quality;

  // draw source → canvas (simulates ctx.drawImage in browser)
  const imgData = ctx.createImageData(info.width, info.height);
  for (let i = 0; i < src.length; i++) imgData.data[i] = src[i];
  ctx.putImageData(imgData, 0, 0);

  // Apply grayscale + contrast + sharpen (simplified with sharp)
  // Actually, just re-render with sharp for consistency
  const final = await sharp(svgBuf).blur(0.6)
    .resize({width: 3000, fit: 'inside'})
    .grayscale().linear(1.4, -51.2).sharpen({sigma:1, m1:1.2})
    .toBuffer();
  return final;
}

const worker = await createWorker("jpn", 1, { gzip: true });

for (const [label, smooth, qual] of [
  ["nearest (off):", false, null],
  ["bilin  low:", true, "low"],
  ["bilin high:", true, "high"],
]) {
  const buf = await simulate(smooth, qual);
  const { data } = await worker.recognize(buf);
  console.log(label, data.text.trim().replace(/\s/g, ""));
}
await worker.terminate();
