"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InstancedGLBModel, type GLBPosition } from "./gl-resources/InstancedGLBModel";
import { FloorPlanGLBModel } from "./FloorPlanGLBModel";
import { dxfToWorld, dxfLengthToWorld, type SceneTransform } from "./coordinateTransform";
import { useHallStore } from "../store";
import { fitStageToRoom, type RoomBounds } from "../stageGeometry";
import type { PlacedObject } from "../placement/types";
import type { StageGeometry } from "../geometry-source/types";

/**
 * Renders the placed furniture (tables or standalone chairs) for the current
 * seating arrangement, using one InstancedGLBModel per furniture kind — one
 * draw call per mesh in that GLB, regardless of instance count. Falls back
 * to plain primitive meshes when the table config has no GLB assigned, same
 * as the legacy app.
 */
function Furniture3D({
  transform,
  glbFileName,
  kind,
}: {
  transform: SceneTransform;
  glbFileName?: string | null;
  kind: "table" | "chair";
}) {
  const placedObjects = useHallStore((s) => s.placedObjects);
  const objects = useMemo(
    () => placedObjects.filter((o): o is Extract<PlacedObject, { type: typeof kind }> => o.type === kind),
    [placedObjects, kind],
  );

  const positions = useMemo<GLBPosition[]>(
    () =>
      objects.map((obj) => {
        const world = dxfToWorld(obj, transform);
        return { x: world.x, y: 0, z: world.z, rotY: THREE.MathUtils.degToRad(obj.rotation || 0) };
      }),
    [objects, transform],
  );

  const first = objects[0];
  const fallbackSize = kind === "table" ? 72 : 18;
  const targetWidth = dxfLengthToWorld(first?.glbWidth ?? first?.width ?? fallbackSize, transform);
  const targetDepth = dxfLengthToWorld(first?.glbDepth ?? first?.height ?? fallbackSize, transform);
  const targetHeight = first?.glbHeight != null ? dxfLengthToWorld(first.glbHeight, transform) : undefined;

  if (!objects.length) return null;

  if (!glbFileName) {
    return (
      <>
        {positions.map((pos, i) =>
          kind === "table" ? (
            <mesh key={i} position={[pos.x, 0.4, pos.z]} castShadow receiveShadow>
              <cylinderGeometry args={[targetWidth / 2, targetWidth / 2, 0.8, 16]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
          ) : (
            <mesh key={i} position={[pos.x, 0.25, pos.z]} castShadow receiveShadow>
              <boxGeometry args={[targetWidth, 0.5, targetDepth]} />
              <meshStandardMaterial color="#654321" />
            </mesh>
          ),
        )}
      </>
    );
  }

  return (
    <InstancedGLBModel
      glbPath={glbFileName}
      positions={positions}
      targetWidth={targetWidth}
      targetDepth={targetDepth}
      targetHeight={targetHeight}
    />
  );
}

function StageGLBModel({ url, y, rotY }: { url: string; y: number; rotY: number }) {
  const gltf = useGLTF(url, true, true);
  return (
    <group position={[0, y, 0]} rotation={[0, rotY, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function StagePlaceholder({ width, depth, y, rotY }: { width: number; depth: number; y: number; rotY: number }) {
  return (
    <mesh position={[0, y + 0.5, 0]} rotation={[0, rotY, 0]} castShadow receiveShadow>
      <boxGeometry args={[width || 4, 1, depth || 2]} />
      <meshStandardMaterial color="#6b7fd7" />
    </mesh>
  );
}

function Stage3D({
  transform,
  stage,
  dxfUnits,
  room,
}: {
  transform: SceneTransform;
  stage: StageGeometry;
  dxfUnits: string;
  room: RoomBounds;
}) {
  const fitted = fitStageToRoom(stage, dxfUnits, room);
  const world = dxfToWorld(fitted, transform);
  const y = stage.position3D?.z ?? 0;
  const rotY = THREE.MathUtils.degToRad(stage.rotation || 0);
  const width = dxfLengthToWorld(fitted.width, transform);
  const depth = dxfLengthToWorld(fitted.depth, transform);

  return (
    <group position={[world.x, 0, world.z]}>
      {stage.glbAssetUrl ? (
        <Suspense fallback={<StagePlaceholder width={width} depth={depth} y={y} rotY={rotY} />}>
          <StageGLBModel url={stage.glbAssetUrl} y={y} rotY={rotY} />
        </Suspense>
      ) : (
        <StagePlaceholder width={width} depth={depth} y={y} rotY={rotY} />
      )}
    </group>
  );
}

/**
 * Scene content shared by both the orbit and walk 3D canvases — the legacy
 * app had this duplicated (and drifting) across HallCanvas3DGlobal.tsx and
 * HallCanvas3DWalk.tsx; here it's one component, and the two views differ
 * only in their camera controls (see HallCanvas3D.tsx).
 */
export function Hall3DSceneContent() {
  const geometry = useHallStore((s) => s.geometry);
  const scaleFactor = useHallStore((s) => s.scaleFactor);
  const sceneCenter = useHallStore((s) => s.sceneCenter);
  const setScaleFactor = useHallStore((s) => s.setScaleFactor);
  const selectedTableArea = useHallStore((s) => s.selectedTableArea());
  const selectedStage = useHallStore((s) => s.selectedStage());

  const dxfBoundsSize = useMemo(() => {
    if (!geometry?.bounds) return null;
    const xs = [geometry.bounds.topLeft.x, geometry.bounds.topRight.x, geometry.bounds.bottomRight.x, geometry.bounds.bottomLeft.x];
    const ys = [geometry.bounds.topLeft.y, geometry.bounds.topRight.y, geometry.bounds.bottomRight.y, geometry.bounds.bottomLeft.y];
    return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }, [geometry?.bounds]);

  if (!geometry || !sceneCenter || !dxfBoundsSize) return null;

  const transform: SceneTransform | null = scaleFactor ? { center: sceneCenter, scaleFactor } : null;
  const groundScale = scaleFactor || 50;
  const room: RoomBounds = {
    minX: sceneCenter.x - dxfBoundsSize.width / 2,
    maxX: sceneCenter.x + dxfBoundsSize.width / 2,
    minY: sceneCenter.y - dxfBoundsSize.height / 2,
    maxY: sceneCenter.y + dxfBoundsSize.height / 2,
  };

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={["#ffffff", "#c7cad1", 0.4]} />

      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[(dxfBoundsSize.width / groundScale) * 1.2, (dxfBoundsSize.height / groundScale) * 1.2]} />
        <meshStandardMaterial color="#e4e6ec" />
      </mesh>

      {geometry.glbAssetUrl ? (
        <FloorPlanGLBModel
          glbAssetUrl={geometry.glbAssetUrl}
          dxfBounds={dxfBoundsSize}
          knownScaleFactor={scaleFactor}
          positionOffset3D={geometry.positionOffset3D}
          onScaleFactorReady={setScaleFactor}
        />
      ) : null}

      {transform ? (
        <>
          <Furniture3D transform={transform} glbFileName={selectedTableArea?.glbFileName} kind="table" />
          <Furniture3D transform={transform} glbFileName={selectedTableArea?.singleChair?.glbFileName} kind="chair" />
          {selectedStage ? <Stage3D transform={transform} stage={selectedStage} dxfUnits={geometry.dxfUnits} room={room} /> : null}
        </>
      ) : null}
    </>
  );
}
