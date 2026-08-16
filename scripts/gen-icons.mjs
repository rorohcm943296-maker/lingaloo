import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const svg = readFileSync(resolve(root, "public/icon.svg"));

for (const [name, size] of [
  ["pwa-192.png", 192],
  ["pwa-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(resolve(root, `public/${name}`));
  console.log("wrote", name, size);
}

await sharp(svg, { density: 300 }).resize(64, 64).png().toFile(resolve(root, "public/favicon.png"));
console.log("wrote favicon.png");
