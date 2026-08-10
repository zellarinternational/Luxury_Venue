import { getGPUTier } from "detect-gpu";

export interface DeviceTier {
  tier: "low" | "mid" | "high";
  /** Passed to R3F Canvas's `dpr` prop. */
  dpr: [number, number];
  shadowsEnabled: boolean;
}

let cached: Promise<DeviceTier> | null = null;

/**
 * `detect-gpu` was a pinned dependency in the legacy app but never actually
 * wired to anything — 3D quality decisions (DPR, shadows) were hardcoded
 * regardless of device. This is the one real, centralized place tier
 * decisions are made, consumed by the 3D canvas' `dpr`/`shadows` setup
 * instead of scattering device checks through rendering code.
 */
export function getDeviceTier(): Promise<DeviceTier> {
  if (!cached) {
    cached = getGPUTier()
      .then((result): DeviceTier => {
        if (result.tier <= 1) return { tier: "low", dpr: [1, 1], shadowsEnabled: false };
        if (result.tier === 2) return { tier: "mid", dpr: [1, 1.5], shadowsEnabled: true };
        return { tier: "high", dpr: [1, 2], shadowsEnabled: true };
      })
      .catch((): DeviceTier => ({ tier: "mid", dpr: [1, 1.5], shadowsEnabled: true }));
  }
  return cached;
}
