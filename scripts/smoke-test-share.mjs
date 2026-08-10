/**
 * Manual smoke test for Phase 5 (share links + optimistic-concurrency sync).
 * Requires a running dev server + seeded DB. Run: node scripts/smoke-test-share.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3001";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;

function check(label, ok, detail = "") {
  failures += ok ? 0 : 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
}

// --- Editor tab: create a share from the main hall planner ---
const editor = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const editorErrors = [];
editor.on("console", (msg) => {
  if (msg.type() === "error" && !msg.text().includes("NaN")) editorErrors.push(msg.text());
});
await editor.goto(`${BASE_URL}/hall?venue=infinity-ballroom`, { waitUntil: "networkidle", timeout: 30000 });
await editor.waitForTimeout(1500);
await editor.locator("#guest-count").fill("300");
await editor.waitForTimeout(1000);

await editor.getByRole("button", { name: "Share" }).click();
await editor.waitForTimeout(1500);
const shareUrl = await editor.locator('input[readonly]').inputValue();
check("share link created", shareUrl.includes("/share/"), shareUrl);
await editor.getByRole("button", { name: "Close" }).click();

const shortCode = shareUrl.split("/share/")[1];

// --- Viewer tab: open the share link, verify it hydrates the same layout ---
const viewer = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const viewerErrors = [];
viewer.on("console", (msg) => {
  if (msg.type() === "error" && !msg.text().includes("NaN")) viewerErrors.push(msg.text());
});
await viewer.goto(shareUrl, { waitUntil: "networkidle", timeout: 30000 });
await viewer.waitForTimeout(2500);
const viewerGuestCount = await viewer.locator("#guest-count").inputValue();
check("viewer hydrated guest count from share", viewerGuestCount === "300", `got ${viewerGuestCount}`);
await viewer.screenshot({ path: "/tmp/share-viewer-initial.png" });

// --- Editor changes guest count; viewer should pick it up via polling ---
await editor.locator("#guest-count").fill("450");
await editor.waitForTimeout(2000); // debounce + push
await viewer.waitForTimeout(6000); // poll interval is 5s
const viewerGuestCountAfterSync = await viewer.locator("#guest-count").inputValue();
check("viewer picked up editor's change via poll", viewerGuestCountAfterSync === "450", `got ${viewerGuestCountAfterSync}`);

// --- Optimistic concurrency: force a stale-version conflict directly against the API ---
const shortCodeRow = await viewer.evaluate(async (code) => {
  const res = await fetch(`/api/trpc/sharedConfigs.getByShortCode?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { shortCode: code } }))}`);
  const json = await res.json();
  return json[0].result.data;
}, shortCode);
check("fetched current shared config via tRPC", !!shortCodeRow, JSON.stringify(shortCodeRow));

const staleVersion = shortCodeRow.version - 1;
const conflictRes = await viewer.evaluate(
  async ({ code, staleVersion, row }) => {
    const res = await fetch("/api/trpc/sharedConfigs.update?batch=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "0": {
          shortCode: code,
          expectedVersion: staleVersion,
          venueId: row.venueId,
          floorPlanId: row.floorPlanId,
          guestCount: 999,
          seatingMode: row.seatingMode,
          selectedTableAreaId: row.selectedTableAreaId,
          customTableArea: row.customTableArea,
          selectedStageId: row.selectedStageId,
        },
      }),
    });
    return { status: res.status, body: await res.json() };
  },
  { code: shortCode, staleVersion, row: shortCodeRow },
);
const gotConflict = conflictRes.body?.[0]?.error?.data?.code === "CONFLICT";
check("stale-version update rejected with CONFLICT (optimistic concurrency)", gotConflict, JSON.stringify(conflictRes).slice(0, 300));

// The forced-conflict fetch above intentionally triggers a 409, which
// surfaces as a "failed to load resource" console entry in this same page —
// expected noise from the test itself, not an app error.
const unexpectedViewerErrors = viewerErrors.filter((e) => !e.includes("409"));
check("no editor console errors", editorErrors.length === 0, JSON.stringify(editorErrors));
check("no viewer console errors", unexpectedViewerErrors.length === 0, JSON.stringify(unexpectedViewerErrors));

await browser.close();
process.exit(failures > 0 ? 1 : 0);
