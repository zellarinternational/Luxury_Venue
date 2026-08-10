"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { DxfFloorPlanVisual, type DxfLoadResult } from "../geometry-source";
import { useHallStore } from "../store";
import { getPolygonBounds, polygonToArray, type Bounds, type Point } from "../placement/geometry";
import type { PlacedObject } from "../placement/types";
import type { DoorArea } from "../placement/doorAreas";
import type { Polygon4 } from "../placement/geometry";

const COLORS = {
  tableArea: "#d4af37",
  door: "#e05252",
  stage: "#6b7fd7",
  table: "#d4af37",
  chair: "#8a8a8a",
  customArea: "#4ade80",
} as const;

/**
 * All markers (tables/chairs/doors/stage/table-area outline) are positioned
 * from raw DXF-unit coordinates stored in the DB. The rendered DXF drawing
 * sits in dxf-viewer's origin-relative space (see loadDxfScene.ts) — every
 * marker position must subtract the same origin to land in the same space
 * as the visual floor plan, or it renders detached from the actual drawing.
 */
function toScene(x: number, y: number, origin: { x: number; y: number }): [number, number] {
  return [x - origin.x, -(y - origin.y)];
}

/** Inverse of toScene — converts a click in scene space back to raw DXF units. */
function toDxf(sceneX: number, sceneY: number, origin: { x: number; y: number }): Point {
  return { x: sceneX + origin.x, y: origin.y - sceneY };
}

/** Same zoom formula CameraFramer applies to the orthographic camera — kept in sync so screen-to-world click mapping matches what's rendered. */
function computeZoom(canvasWidth: number, canvasHeight: number, span: number): number {
  return Math.min(canvasWidth, canvasHeight) / (span * 1.3);
}

function PolygonOutline({ polygon, origin, color, opacity = 0.5 }: { polygon: Polygon4; origin: { x: number; y: number }; color: string; opacity?: number }) {
  const points = useMemo(() => {
    const corners = [polygon.topLeft, polygon.topRight, polygon.bottomRight, polygon.bottomLeft, polygon.topLeft];
    return corners.map((p) => {
      const [x, y] = toScene(p.x, p.y, origin);
      return [x, y, 0.1] as [number, number, number];
    });
  }, [polygon, origin]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} opacity={opacity} transparent />
    </line>
  );
}

function DoorAreaMarker({ door, origin }: { door: DoorArea; origin: { x: number; y: number } }) {
  const { topLeft, bottomRight } = door.polygon;
  const [cx, cy] = toScene((topLeft.x + bottomRight.x) / 2, (topLeft.y + bottomRight.y) / 2, origin);
  const w = Math.abs(bottomRight.x - topLeft.x);
  const h = Math.abs(bottomRight.y - topLeft.y);

  return (
    <mesh position={[cx, cy, 0.05]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={COLORS.door} transparent opacity={0.35} />
    </mesh>
  );
}

function TableMarker({ object, origin }: { object: Extract<PlacedObject, { type: "table" }>; origin: { x: number; y: number } }) {
  const [x, y] = toScene(object.x, object.y, origin);
  return (
    <mesh position={[x, y, 0.2]}>
      <circleGeometry args={[object.width / 2, 24]} />
      <meshBasicMaterial color={COLORS.table} transparent opacity={0.85} />
    </mesh>
  );
}

function ChairMarker({ object, origin }: { object: Extract<PlacedObject, { type: "chair" }>; origin: { x: number; y: number } }) {
  const [x, y] = toScene(object.x, object.y, origin);
  return (
    <mesh position={[x, y, 0.2]}>
      <circleGeometry args={[object.width / 2, 12]} />
      <meshBasicMaterial color={COLORS.chair} />
    </mesh>
  );
}

function StageMarker({
  x,
  y,
  width,
  depth,
  rotation,
  origin,
}: {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  origin: { x: number; y: number };
}) {
  const [sx, sy] = toScene(x, y, origin);
  return (
    <mesh position={[sx, sy, 0.15]} rotation={[0, 0, (-rotation * Math.PI) / 180]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={COLORS.stage} transparent opacity={0.6} />
    </mesh>
  );
}

function CustomAreaPointMarkers({ origin }: { origin: { x: number; y: number } }) {
  const points = useHallStore((s) => s.customAreaPoints);
  return (
    <>
      {points.map((p, i) => {
        const [x, y] = toScene(p.x, p.y, origin);
        return (
          <mesh key={i} position={[x, y, 0.25]}>
            <circleGeometry args={[8, 16]} />
            <meshBasicMaterial color={COLORS.customArea} />
          </mesh>
        );
      })}
    </>
  );
}

function SceneContent({
  origin,
  onDxfLoaded,
}: {
  origin: { x: number; y: number };
  onDxfLoaded: (result: DxfLoadResult) => void;
}) {
  const geometry = useHallStore((s) => s.geometry);
  const placedObjects = useHallStore((s) => s.placedObjects);
  const selectedTableArea = useHallStore((s) => s.selectedTableArea());
  const selectedStageId = useHallStore((s) => s.selectedStageId);

  if (!geometry) return null;

  const selectedStage = geometry.stages.find((s) => s.id === selectedStageId);

  return (
    <>
      <ambientLight intensity={1} />
      {geometry.dxfAssetUrl ? <DxfFloorPlanVisual assetUrl={geometry.dxfAssetUrl} onLoaded={onDxfLoaded} /> : null}
      <CustomAreaPointMarkers origin={origin} />

      {selectedTableArea?.namedPoints ? (
        <PolygonOutline
          polygon={selectedTableArea.namedPoints}
          origin={origin}
          color={selectedTableArea.id === "__custom__" ? COLORS.customArea : COLORS.tableArea}
        />
      ) : null}

      {geometry.doorAreas.map((door) => (
        <DoorAreaMarker key={door.id} door={door} origin={origin} />
      ))}

      {selectedStage ? (
        <StageMarker
          x={selectedStage.x}
          y={selectedStage.y}
          width={selectedStage.width}
          depth={selectedStage.depth}
          rotation={selectedStage.rotation}
          origin={origin}
        />
      ) : null}

      {placedObjects.map((object) =>
        object.type === "table" ? (
          <TableMarker key={object.id} object={object} origin={origin} />
        ) : (
          <ChairMarker key={object.id} object={object} origin={origin} />
        ),
      )}
    </>
  );
}

/** Bounds (in origin-relative scene space) to frame the camera on: the selected table area if known, else the whole DXF drawing. */
function useFrameBounds(dxfBounds: Bounds | null, origin: { x: number; y: number } | null) {
  const tableArea = useHallStore((s) => s.selectedTableArea());

  return useMemo(() => {
    if (!origin) return null;
    if (tableArea?.namedPoints) {
      const raw = getPolygonBounds(polygonToArray(tableArea.namedPoints));
      return {
        minX: raw.minX - origin.x,
        maxX: raw.maxX - origin.x,
        minY: -(raw.maxY - origin.y),
        maxY: -(raw.minY - origin.y),
      };
    }
    if (dxfBounds) {
      return {
        minX: dxfBounds.minX - origin.x,
        maxX: dxfBounds.maxX - origin.x,
        minY: -(dxfBounds.maxY - origin.y),
        maxY: -(dxfBounds.minY - origin.y),
      };
    }
    return null;
  }, [dxfBounds, origin, tableArea]);
}

/**
 * Applies camera framing imperatively instead of via the `<Canvas camera>`
 * prop (which only applies once, at mount). This used to be done by
 * remounting the whole `<Canvas>` with a changed `key` once framing became
 * known — correct, but it briefly creates a second WebGL context per view
 * (the DXF-viewer's own offscreen parse context, plus one per Canvas
 * mount), and this app can end up with several 2D/3D canvases churning in
 * a session; keeping the same context and just re-pointing the camera
 * avoids that.
 */
function CameraFramer({ center, span }: { center: { x: number; y: number }; span: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(center.x, center.y, 100);
    const cam = camera as unknown as { zoom: number; updateProjectionMatrix: () => void };
    cam.zoom = computeZoom(size.width, size.height, span);
    cam.updateProjectionMatrix();
  }, [camera, center.x, center.y, span, size.width, size.height]);
  return null;
}

/**
 * Top-down orthographic floor-plan view. Deliberately renders tables/chairs
 * as clean, legible shapes (not per-table DXF/GLB models) — for reviewing
 * capacity and layout at a glance, dense CAD furniture blocks are harder to
 * read than a simple diagram; the 3D views (Phase 4b) carry the realistic
 * furniture rendering. The camera frames the currently selected seating
 * area (not just the whole building outline), since that's what a user
 * planning a layout actually wants to see first.
 */
export function HallCanvas2D() {
  const [dxfResult, setDxfResult] = useState<DxfLoadResult | null>(null);
  const origin = dxfResult?.origin ?? null;
  const frame = useFrameBounds(dxfResult?.bounds ?? null, origin);
  const isSelectingCustomArea = useHallStore((s) => s.isSelectingCustomArea);
  const addCustomAreaPoint = useHallStore((s) => s.addCustomAreaPoint);
  const containerRef = useRef<HTMLDivElement>(null);

  const center = frame ? { x: (frame.minX + frame.maxX) / 2, y: (frame.minY + frame.maxY) / 2 } : { x: 0, y: 0 };
  const span = frame ? Math.max(frame.maxX - frame.minX, frame.maxY - frame.minY) : 2000;

  // Custom-area point placement is handled here, at the DOM level, rather
  // than via an R3F mesh's onClick/raycasting — deliberately, after an
  // invisible click-catcher plane never registered a single hit in this
  // Canvas (confirmed even on the always-visible, always-mounted table
  // markers), while native DOM pointer events on the canvas element fired
  // reliably throughout. Screen -> scene -> DXF is simple, well-defined
  // math for a top-down orthographic camera, so this sidesteps the
  // raycasting issue entirely rather than chasing it further.
  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingCustomArea || !origin || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const zoom = computeZoom(rect.width, rect.height, span);
    const sceneX = center.x + (offsetX - rect.width / 2) / zoom;
    const sceneY = center.y + (rect.height / 2 - offsetY) / zoom;
    addCustomAreaPoint(toDxf(sceneX, sceneY, origin));
  };

  return (
    <div ref={containerRef} onClick={handleCanvasClick} className="h-full w-full">
      <Canvas orthographic camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}>
        <CameraFramer center={center} span={span} />
        {origin ? <SceneContent origin={origin} onDxfLoaded={setDxfResult} /> : <DxfLoaderBootstrap onLoaded={setDxfResult} />}
        <OrbitControls enabled={!isSelectingCustomArea} enableRotate={false} enableDamping={false} target={[center.x, center.y, 0]} />
      </Canvas>
    </div>
  );
}

/** Renders just the DXF visual until the first `onLoaded` gives us an origin to align everything else to. */
function DxfLoaderBootstrap({ onLoaded }: { onLoaded: (result: DxfLoadResult) => void }) {
  const geometry = useHallStore((s) => s.geometry);
  if (!geometry?.dxfAssetUrl) return null;
  return <DxfFloorPlanVisual assetUrl={geometry.dxfAssetUrl} onLoaded={onLoaded} />;
}
