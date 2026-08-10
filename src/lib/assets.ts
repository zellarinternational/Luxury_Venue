/**
 * DB rows store bare legacy filenames (e.g. "floor-plan.dxf"), matching the
 * asset-manifest's legacyPath. This resolves that filename to a servable
 * URL: locally that's public/assets/{kind}/{fileName} (see
 * scripts/copy-legacy-assets.ts); in production, set
 * NEXT_PUBLIC_ASSET_BASE_URL to a CDN/R2 base once assets are migrated
 * there (see docs/ARCHITECTURE_PLAN.md §6) — no code changes needed.
 */
const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "";

export function getAssetUrl(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const ext = fileName.split(".").pop()?.toLowerCase();
  const kind = ext === "glb" ? "glb" : ext === "dxf" ? "dxf" : "misc";
  // Some legacy filenames contain spaces (e.g. "GRAND HAYAT.glb") — encode
  // the segment, not the whole path, so the /assets/{kind}/ prefix stays readable.
  return `${ASSET_BASE_URL}/assets/${kind}/${encodeURIComponent(fileName)}`;
}
