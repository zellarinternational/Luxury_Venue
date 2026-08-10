/**
 * Copies the canonical GLB/DXF assets identified in
 * server/db/seed/data/asset-manifest.json (the 53 files actually referenced
 * by the 2 real venues) from the OLD repo's public/ into this repo's
 * public/assets/{glb,dxf}/. Local-dev stand-in for the eventual R2 upload
 * (see docs/ARCHITECTURE_PLAN.md §6) — nothing here is committed to git
 * (public/assets/ is gitignored); re-run this script after a fresh clone.
 *
 * Run via: npx tsx scripts/copy-legacy-assets.ts
 */
import fs from "fs";
import path from "path";

const OLD_REPO_PUBLIC = "/Users/utkarshsingh/Desktop/Luxury_Venue_Setup/public";
const NEW_REPO_PUBLIC = path.join(__dirname, "..", "public");

interface ManifestEntry {
  legacyPath: string;
  kind: "glb" | "dxf";
}

const manifest: ManifestEntry[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "server", "db", "seed", "data", "asset-manifest.json"),
    "utf-8",
  ),
);

let copied = 0;
let missing = 0;

for (const entry of manifest) {
  const src = path.join(OLD_REPO_PUBLIC, entry.legacyPath);
  const destDir = path.join(NEW_REPO_PUBLIC, "assets", entry.kind);
  const dest = path.join(destDir, entry.legacyPath);

  if (!fs.existsSync(src)) {
    console.warn(`MISSING source file: ${entry.legacyPath}`);
    missing++;
    continue;
  }

  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}

console.log(`Copied ${copied} assets, ${missing} missing.`);
