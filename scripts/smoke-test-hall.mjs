/**
 * Manual smoke test for the hall planner (Phase 4a). Not part of `npm test`
 * — requires a running dev server + seeded DB (`npm run dev`, Postgres up).
 * Screenshots real, interactive R3F canvas output that unit tests can't
 * verify (DXF actually rendering, markers aligned to it, door avoidance
 * visually holding). Run: node scripts/smoke-test-hall.mjs
 *
 * See docs/ARCHITECTURE_PLAN.md §8 (Phase 4 verification) for the longer-term
 * plan to formalize this into headless visual-regression screenshot diffing.
 */
import { chromium } from "playwright";

const VENUES = ["infinity-ballroom", "grand-hyatt-mumbai-ballroom"];
const BASE_URL = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

for (const venue of VENUES) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("NaN")) errors.push(msg.text());
  });

  await page.goto(`${BASE_URL}/hall?venue=${venue}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `/tmp/smoke-${venue}-initial.png` });

  await page.locator("#guest-count").fill("300");
  await page.waitForTimeout(1500);
  const statsAfterGuestCount = (await page.locator("aside").textContent())?.replace(/\s+/g, " ").trim();
  await page.screenshot({ path: `/tmp/smoke-${venue}-300-guests.png` });

  await page.getByText("Tables only", { exact: true }).click();
  await page.waitForTimeout(1000);
  const statsAfterTablesOnly = (await page.locator("aside").textContent())?.replace(/\s+/g, " ").trim();
  await page.screenshot({ path: `/tmp/smoke-${venue}-tables-only.png` });

  const ok = errors.length === 0;
  failures += ok ? 0 : 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${venue}`);
  console.log(`  after guestCount=300: ${statsAfterGuestCount}`);
  console.log(`  after 'Tables only':  ${statsAfterTablesOnly}`);
  if (!ok) console.log(`  console errors: ${JSON.stringify(errors)}`);

  await page.close();
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
