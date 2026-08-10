"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { calculateScaleFactor } from "./coordinateTransform";
import type { Point } from "../placement/geometry";

/**
 * Loads, scales, and centers the floor-plan GLB so it lines up with where
 * `dxfToWorld` places tables/chairs/stage. The GLB is authored at its own
 * native size (e.g. ~114 units wide for a room that's 2290 DXF-inches
 * wide) — the same units furniture placement never sees, since that goes
 * through `scaleFactor` instead. Without rescaling the floor mesh by
 * `(dxfWidth / scaleFactor) / glbWidth`, the floor renders at a completely
 * different size than the coordinate space furniture is placed in.
 *
 * Unless the DB already has a `scaleFactor` for this floor plan, one is
 * derived from the GLB's whole-scene bounds vs. the DXF-unit bounds and
 * reported up via `onScaleFactorReady` exactly once. See
 * coordinateTransform.ts for why this must be the only place that
 * computation happens.
 */
export function FloorPlanGLBModel({
  glbAssetUrl,
  dxfBounds,
  knownScaleFactor,
  positionOffset3D,
  onScaleFactorReady,
}: {
  glbAssetUrl: string;
  dxfBounds: { width: number; height: number };
  knownScaleFactor: number | null;
  positionOffset3D?: { x: number; y: number; z: number } | null;
  onScaleFactorReady: (scaleFactor: number) => void;
}) {
  const gltf = useGLTF(glbAssetUrl, true, true);
  const reportedRef = useRef(false);
  const [center, box] = useMemo(() => {
    // Whole-scene bounds, not a single "largest footprint mesh" heuristic:
    // this floor model's biggest-footprint mesh turned out to be a combined
    // room shell (walls+ceiling included, ~9 world units tall), which threw
    // off the per-mesh heuristic ported from the legacy app's Walk view.
    // The whole scene's XZ footprint matched the DXF bounds just as well
    // for our actual assets, with a simpler calculation.
    const b = new THREE.Box3().setFromObject(gltf.scene);
    return [b.getCenter(new THREE.Vector3()), b] as const;
  }, [gltf.scene]);

  useEffect(() => {
    if (knownScaleFactor != null || reportedRef.current) return;
    const size = box.getSize(new THREE.Vector3());
    if (size.x <= 0 || size.z <= 0) return;
    reportedRef.current = true;
    onScaleFactorReady(calculateScaleFactor({ width: size.x, depth: size.z }, dxfBounds));
  }, [box, dxfBounds, knownScaleFactor, onScaleFactorReady]);

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [gltf.scene]);

  // Nothing to render at the right size/position until a scaleFactor exists
  // (DB value, or the async self-computed one lands and triggers a re-render).
  if (knownScaleFactor == null) return null;

  const size = box.getSize(new THREE.Vector3());
  const modelScale = size.x > 0 && size.z > 0 ? (dxfBounds.width / knownScaleFactor / size.x + dxfBounds.height / knownScaleFactor / size.z) / 2 : 1;

  const ox = positionOffset3D?.x ?? 0;
  const oy = positionOffset3D?.y ?? 0;
  const oz = positionOffset3D?.z ?? 0;

  return (
    <group position={[ox, oy, oz]}>
      <group scale={modelScale}>
        <group position={[-center.x, 0, -center.z]}>
          <primitive object={gltf.scene} />
        </group>
      </group>
    </group>
  );
}

export type { Point };
