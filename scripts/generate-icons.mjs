import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Draw the app mark once, emit every format that asks for it.
 *
 * The mark is an ember on the brand violet: an amber coal glowing yellow
 * from underneath, a soft violet halo, and two sparks rising off it. It
 * is built from flat circles, not gradients — a gradient turns to mush at
 * 16px, and a favicon is read at 16px or not at all.
 *
 * Everything is drawn from signed distance fields rather than rasterised from
 * the SVG, because there is no rasteriser in this project's dependency tree and
 * adding sharp to draw one letter is not a trade worth making. The upside is
 * that the SVG and the bitmaps come from the same numbers below, so they cannot
 * drift: edit the geometry here and re-run `pnpm icons`.
 *
 * Outputs, all committed:
 *   app/icon.svg          what modern browsers actually use
 *   app/favicon.ico       16/32/48, for /favicon.ico fetchers that ignore <link>
 *   app/apple-icon.png    180x180, full-bleed — iOS applies its own mask
 *   public/icon-192.png   the manifest, which needs stable unhashed URLs
 *   public/icon-512.png   ditto; Chrome wants a 192 and a 512 to offer install
 */

/* --- Geometry, on a 32-unit grid ------------------------------------------ */

const GRID = 32;

/**
 * --color-violet, oklch(55% 0.235 295), converted once. An .ico file has no
 * idea what oklch is, so hex is the portable spelling.
 */
const VIOLET = [0x81, 0x41, 0xe8];

/* The ember, in layers from the back. Each is [cx, cy, r, colour, opacity]. */
const HALO = [15, 19.4, 10.2, [0xb5, 0x9b, 0xff], 0.3];
const COAL = [15, 19.4, 7.4, [0xff, 0xb3, 0x5c], 1];
// Lower-left of the coal: an ember glows hottest underneath.
const CORE = [13.4, 21.2, 3.7, [0xff, 0xe3, 0x9a], 1];
// Two sparks lifting off, shrinking as they rise.
const SPARK = [22.4, 10.4, 2, [0xff, 0xe3, 0x9a], 1];
const SPARK_HIGH = [25.6, 5.8, 1.2, [0xff, 0xe3, 0x9a], 1];
const LAYERS = [HALO, COAL, CORE, SPARK, SPARK_HIGH];

/**
 * Tighter than --radius-control's 10/40. A softer corner reads as a blur at
 * 16px; this one still reads as a corner.
 */
const CORNER = 7;

/* --- Distance fields ------------------------------------------------------ */

/** Distance to a rounded box centred on the grid. Negative inside. */
function sdBox(x, y, half, radius) {
  const qx = Math.abs(x - GRID / 2) - (half - radius);
  const qy = Math.abs(y - GRID / 2) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance to a circle's edge. Negative inside. */
function sdCircle(x, y, [cx, cy, r]) {
  return Math.hypot(x - cx, y - cy) - r;
}

/* --- Raster --------------------------------------------------------------- */

/**
 * Coverage from a distance, in grid units, for a pixel one `px` wide. This is
 * the analytic antialias: at 16px a 4x supersample has only 16 levels to spend
 * on an edge, and a small circle shows it.
 */
function coverage(d, px) {
  return Math.min(1, Math.max(0, 0.5 - d / px));
}

/**
 * RGBA8 for one square icon. `rounded` is false for the iOS icon, which the
 * platform masks itself and which looks pinched if it arrives pre-rounded.
 */
function render(size, rounded) {
  const px = GRID / size;
  const out = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      const x = ((pxi + 0.5) * GRID) / size;
      const y = ((py + 0.5) * GRID) / size;

      const plate = coverage(sdBox(x, y, GRID / 2, rounded ? CORNER : 0), px);

      // Composite the ember's layers over the plate, back to front.
      const colour = [...VIOLET];
      for (const layer of LAYERS) {
        const a = Math.min(coverage(sdCircle(x, y, layer), px), plate) * layer[4];
        for (let c = 0; c < 3; c++) colour[c] += (layer[3][c] - colour[c]) * a;
      }

      const i = (py * size + pxi) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(colour[c]);
      out[i + 3] = Math.round(plate * 255);
    }
  }

  return out;
}

/* --- PNG ------------------------------------------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePNG(size, rgba) {
  // Filter type 0 on every scanline. These are tiny and mostly flat colour, so
  // deflate does the work and a smarter filter would save bytes we never spend.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --- ICO ------------------------------------------------------------------ */

/**
 * PNG-compressed frames, which every browser and every Windows since Vista
 * reads. The alternative is a bottom-up BMP plus a vestigial AND mask, and the
 * two most common ways to ship a broken .ico are getting either of those wrong.
 */
function encodeICO(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const dir = [];

  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    entry[0] = size < 256 ? size : 0; // 0 means 256
    entry[1] = size < 256 ? size : 0;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dir.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...dir, ...frames.map((f) => f.png)]);
}

/* --- SVG ------------------------------------------------------------------ */

const toHex = (rgb) => "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");

function encodeSVG() {
  const circles = LAYERS.map(
    ([cx, cy, r, rgb, opacity]) =>
      `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${toHex(rgb)}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}/>`,
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="Emberspace">
  <rect width="${GRID}" height="${GRID}" rx="${CORNER}" fill="${toHex(VIOLET)}"/>
${circles}
</svg>
`;
}

/* --- Emit ----------------------------------------------------------------- */

const APP = "app";
const PUBLIC = "public";

const written = [];

function emit(path, bytes) {
  writeFileSync(path, bytes);
  written.push(`${path} (${bytes.length} bytes)`);
}

emit(join(APP, "icon.svg"), Buffer.from(encodeSVG()));

emit(
  join(APP, "favicon.ico"),
  encodeICO([16, 32, 48].map((size) => ({ size, png: encodePNG(size, render(size, true)) }))),
);

// Full-bleed: iOS rounds this itself, and a pre-rounded icon comes out pinched.
emit(join(APP, "apple-icon.png"), encodePNG(180, render(180, false)));

// Rounded: these are declared purpose "any", so Android draws them as supplied.
for (const size of [192, 512]) {
  emit(join(PUBLIC, `icon-${size}.png`), encodePNG(size, render(size, true)));
}

console.log(written.map((line) => `  ${line}`).join("\n"));
