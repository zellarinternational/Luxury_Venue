/**
 * Manual smoke test for Phase 4b (3D orbit/walk views + custom-area drawing).
 * Requires a running dev server + seeded DB. Run: node scripts/smoke-test-hall-3d.mjs
 *
 * Each view gets its own page (not tab-switches within one page/session):
 * the floor-plan GLB is tens of MB (Draco/meshopt-compressed architectural
 * mesh), and on a weak/virtual GPU, keeping two continuously-rendering
 * WebGL canvases' worth of render-loop load on the main thread in one
 * session was enough to make Playwright's own interaction checks time out.
 * Separate pages avoid that and are also more realistic per-scenario
 * isolation for a smoke test.
 */
import { chromium } from "playwright";

const VENUES = ["infinity-ballroom", "grand-hyatt-mumbai-ballroom"];
const BASE_URL = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

async function checkView(venue, viewLabel, screenshotSuffix, waitMs) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("NaN")) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE_URL}/hall?venue=${venue}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator("#guest-count").fill("300");
  await page.waitForTimeout(1500);

  if (viewLabel !== "2D plan") {
    await page.getByRole("tab", { name: viewLabel }).click();
  }
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `/tmp/smoke3d-${venue}-${screenshotSuffix}.png` });

  const ok = errors.length === 0;
  failures += ok ? 0 : 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${venue} — ${viewLabel}`);
  if (!ok) console.log(`  console errors: ${JSON.stringify(errors)}`);

  await page.close();
}

async function checkCustomAreaDrawing(venue) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${BASE_URL}/hall?venue=${venue}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator("#guest-count").fill("300");
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Draw custom area/ }).click();
  const canvasBox = await page.locator("canvas").boundingBox();
  if (canvasBox) {
    const cx = canvasBox.x + canvasBox.width / 2;
    const cy = canvasBox.y + canvasBox.height / 2;
    const corners = [
      [cx - 100, cy - 60],
      [cx + 100, cy - 60],
      [cx + 100, cy + 60],
      [cx - 100, cy + 60],
    ];
    for (const [x, y] of corners) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/smoke3d-${venue}-custom-area.png` });
  const hasClearButton = (await page.getByRole("button", { name: "Clear custom area" }).count()) > 0;

  failures += hasClearButton ? 0 : 1;
  console.log(`${hasClearButton ? "PASS" : "FAIL"} ${venue} — custom area drawing`);

  await page.close();
}

for (const venue of VENUES) {
  await checkView(venue, "2D plan", "2d", 2000);
  // First orbit visit per venue decodes the floor GLB from scratch.
  await checkView(venue, "3D orbit", "orbit", 20000);
  await checkView(venue, "3D walk", "walk", 10000);
  await checkCustomAreaDrawing(venue);
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
