"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { loadDxfScene, type DxfBounds } from "./loadDxfScene";

export interface DxfLoadResult {
  bounds: DxfBounds;
  origin: { x: number; y: number };
}

export interface DxfFloorPlanVisualProps {
  assetUrl: string;
  onLoaded?: (result: DxfLoadResult) => void;
}

/**
 * Renders a DXF file's architectural drawing inside an R3F scene. This is
 * the only place in the app (besides ./loadDxfScene) that touches
 * dxf-viewer output — everything else consumes plain numbers via
 * FloorPlanGeometry.
 *
 * Important: the rendered geometry sits in dxf-viewer's origin-relative
 * coordinate space (see loadDxfScene's `origin` doc comment). Anything
 * placed alongside it using raw DXF-unit coordinates (tables, doors,
 * stages) must subtract the same `origin` via `onLoaded`, or it will render
 * offset from the actual drawing.
 */
export function DxfFloorPlanVisual({ assetUrl, onLoaded }: DxfFloorPlanVisualProps) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setObject(null);
    setError(null);

    loadDxfScene(assetUrl)
      .then((result) => {
        if (cancelled) return;
        setObject(result.object);
        onLoaded?.({ bounds: result.bounds, origin: result.origin });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUrl]);

  if (error) {
    console.error(`[DxfFloorPlanVisual] failed to load ${assetUrl}:`, error);
    return null;
  }
  if (!object) return null;

  return <primitive object={object} />;
}
