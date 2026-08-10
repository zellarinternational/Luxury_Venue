"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Hall3DSceneContent } from "./Hall3DScene";
import { WalkControls, type WalkBounds } from "./WalkControls";
import { dxfToWorld } from "./coordinateTransform";
import { getDeviceTier, type DeviceTier } from "./gl-resources/deviceTier";
import { useHallStore } from "../store";

/**
 * Top-down-ish orbit camera (the legacy app's "Global" view) and first-person
 * "Walk" navigation, sharing one scene graph (Hall3DSceneContent) and
 * differing only in their camera controls — see Hall3DSceneContent's doc
 * comment for why that's a deliberate consolidation vs. the legacy app's two
 * near-duplicate 3000+ line files.
 */
export function HallCanvas3D({ mode }: { mode: "orbit" | "walk" }) {
  const geometry = useHallStore((s) => s.geometry);
  const scaleFactor = useHallStore((s) => s.scaleFactor);
  const sceneCenter = useHallStore((s) => s.sceneCenter);
  const [tier, setTier] = useState<DeviceTier | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDeviceTier().then((t) => {
      if (!cancelled) setTier(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const walkBounds = useMemo<WalkBounds | null>(() => {
    if (!geometry?.bounds || !sceneCenter || !scaleFactor) return null;
    const transform = { center: sceneCenter, scaleFactor };
    const corners = [geometry.bounds.topLeft, geometry.bounds.topRight, geometry.bounds.bottomRight, geometry.bounds.bottomLeft].map((p) =>
      dxfToWorld(p, transform),
    );
    const padding = 50 / scaleFactor; // ~50 DXF-unit walk-around margin, converted to world units
    return {
      minX: Math.min(...corners.map((c) => c.x)) - padding,
      maxX: Math.max(...corners.map((c) => c.x)) + padding,
      minZ: Math.min(...corners.map((c) => c.z)) - padding,
      maxZ: Math.max(...corners.map((c) => c.z)) + padding,
    };
  }, [geometry?.bounds, sceneCenter, scaleFactor]);

  const walkStart = geometry?.walkStartPosition;
  const initialCameraPosition: [number, number, number] = mode === "walk" && walkStart ? [walkStart.x, walkStart.y, walkStart.z] : [0, 40, 40];

  if (!geometry?.glbAssetUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        No 3D model available for this floor plan yet.
      </div>
    );
  }

  return (
    <Canvas
      shadows={tier?.shadowsEnabled ?? true}
      dpr={tier?.dpr ?? [1, 1.5]}
      camera={{ position: initialCameraPosition, fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false, stencil: false }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.shadowMap.enabled = tier?.shadowsEnabled ?? true;
        gl.setClearColor("#f6f7fb", 1);
        if (mode === "walk" && walkStart) {
          camera.rotation.set(0, THREE.MathUtils.degToRad(walkStart.rotation), 0, "YXZ");
        }
      }}
    >
      <Hall3DSceneContent />
      {mode === "orbit" ? (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.15}
          maxDistance={500}
          maxPolarAngle={Math.PI * 0.49}
          minPolarAngle={0.1}
          screenSpacePanning
        />
      ) : (
        <WalkControls bounds={walkBounds} />
      )}
    </Canvas>
  );
}
