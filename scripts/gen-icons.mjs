// Generates PNG icons for PWA from SVG
// Run: node scripts/gen-icons.mjs
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 512;

  // Background
  ctx.fillStyle = "#1d4ed8";
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();

  // Wheels
  ctx.strokeStyle = "white";
  ctx.lineWidth = 20 * s;
  ctx.beginPath(); ctx.arc(180 * s, 320 * s, 48 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(332 * s, 320 * s, 48 * s, 0, Math.PI * 2); ctx.stroke();

  // Frame
  ctx.fillStyle = "white";
  ctx.fillRect(180 * s, 295 * s, 152 * s, 14 * s);

  // Body
  ctx.beginPath();
  ctx.roundRect(220 * s, 240 * s, 72 * s, 55 * s, 10 * s);
  ctx.fill();

  // Handlebars
  ctx.beginPath();
  ctx.moveTo(220 * s, 240 * s);
  ctx.lineTo(260 * s, 190 * s);
  ctx.lineTo(292 * s, 240 * s);
  ctx.fill();

  // GPS pin
  ctx.beginPath(); ctx.arc(360 * s, 130 * s, 28 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(360 * s, 175 * s);
  ctx.lineTo(342 * s, 145 * s);
  ctx.lineTo(378 * s, 145 * s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath(); ctx.arc(360 * s, 130 * s, 12 * s, 0, Math.PI * 2); ctx.fill();

  return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

for (const size of sizes) {
  const buf = drawIcon(size);
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`✓ icon-${size}.png`);
}
console.log("Done!");
