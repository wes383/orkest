/**
 * Generate PWA icons from logo.svg
 * Run: node scripts/generate-pwa-icons.js
 * Requires: npm install -D sharp
 */
import { readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SVG_PATH = join(ROOT, "public", "logo.svg");
const OUT_DIR = join(ROOT, "public", "icons");

// Brand color for the circle fill (replaces currentColor)
const BRAND_COLOR = "#000000"; // black
const BG_COLOR = "#ffffff";

async function main() {
  // Dynamic import so sharp is only required when running this script
  const { default: sharp } = await import("sharp");

  await mkdir(OUT_DIR, { recursive: true });

  const svgSource = await readFile(SVG_PATH, "utf-8");

  // Replace currentColor with brand color for the filled circle
  const coloredSvg = svgSource.replace(/currentColor/g, BRAND_COLOR);

  const sizes = [
    { name: "icon-192.png", size: 192, maskable: false },
    { name: "icon-512.png", size: 512, maskable: false },
    { name: "maskable-192.png", size: 192, maskable: true },
    { name: "maskable-512.png", size: 512, maskable: true },
  ];

  for (const { name, size, maskable } of sizes) {
    let pipeline = sharp(Buffer.from(coloredSvg)).resize(size, size);

    if (maskable) {
      // Maskable icons need ~20% padding (safe zone)
      const innerSize = Math.round(size * 0.6);
      const offset = Math.round((size - innerSize) / 2);

      pipeline = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: BRAND_COLOR,
        },
      }).composite([
        {
          input: await sharp(Buffer.from(coloredSvg))
            .resize(innerSize, innerSize)
            .toBuffer(),
          top: offset,
          left: offset,
        },
      ]);
    }

    await pipeline.png().toFile(join(OUT_DIR, name));
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  console.log("\nDone! Icons saved to public/icons/");
}

main().catch((err) => {
  console.error("Failed to generate icons:", err.message);
  console.error("Install sharp: npm install -D sharp");
  process.exit(1);
});
