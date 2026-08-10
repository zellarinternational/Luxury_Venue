"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface GLBPosition {
  x: number;
  y: number;
  z: number;
  /** Y-axis rotation in radians. */
  rotY: number;
}

/**
 * Renders N instances of a GLB model using THREE.InstancedMesh.
 *
 * Instead of cloning the scene N times (N x M draw calls), this creates ONE
 * InstancedMesh per mesh inside the GLB (M draw calls total), regardless of
 * how many instances are displayed. For 200 tables with 5 meshes each, this
 * reduces draw calls from 1000 to 5. `useGLTF` already caches the parsed
 * GLTF per URL, so multiple `InstancedGLBModel`s sharing a `glbPath` (e.g.
 * both real venues use the same chair model) parse it only once.
 */
export function InstancedGLBModel({
  glbPath,
  positions,
  targetWidth,
  targetDepth,
  targetHeight,
  castShadow = true,
  receiveShadow = true,
}: {
  glbPath: string;
  positions: GLBPosition[];
  targetWidth: number;
  targetDepth: number;
  targetHeight?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const gltf = useGLTF(glbPath, true, true);
  const count = positions.length;

  const meshList = useMemo(() => {
    if (!gltf.scene) return [];

    gltf.scene.updateWorldMatrix(true, true);
    const sceneInv = gltf.scene.matrixWorld.clone().invert();

    const list: Array<{
      geometry: THREE.BufferGeometry;
      material: THREE.Material | THREE.Material[];
      localMatrix: THREE.Matrix4;
    }> = [];

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const localMatrix = new THREE.Matrix4().multiplyMatrices(sceneInv, mesh.matrixWorld);
        list.push({ geometry: mesh.geometry, material: mesh.material, localMatrix: localMatrix.clone() });
      }
    });

    return list;
  }, [gltf.scene]);

  const modelScale = useMemo(() => {
    if (!gltf.scene || !targetWidth || !targetDepth) return 1;

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) return 1;

    const scales: number[] = [];
    if (size.x > 0) scales.push(targetWidth / size.x);
    if (size.z > 0) scales.push(targetDepth / size.z);
    if (targetHeight !== undefined && size.y > 0) scales.push(targetHeight / size.y);

    const raw = scales.length > 0 ? scales.reduce((a, b) => a + b, 0) / scales.length : 1;
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [gltf.scene, targetWidth, targetDepth, targetHeight]);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);

  useEffect(() => {
    if (!meshList.length || !count) return;

    meshList.forEach((info, meshIdx) => {
      const im = meshRefs.current[meshIdx];
      if (!im) return;

      positions.forEach((pos, i) => {
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z) || !Number.isFinite(pos.rotY)) {
          tempMatrix.identity();
          im.setMatrixAt(i, tempMatrix);
          return;
        }
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0, "XYZ");
        dummy.scale.setScalar(modelScale);
        dummy.updateMatrix();

        tempMatrix.multiplyMatrices(dummy.matrix, info.localMatrix);
        im.setMatrixAt(i, tempMatrix);
      });

      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  }, [positions, meshList, count, modelScale, dummy, tempMatrix]);

  if (!meshList.length || !count) return null;

  return (
    <>
      {meshList.map((info, i) => (
        <instancedMesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          args={[info.geometry, info.material as THREE.Material, count]}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          frustumCulled
        />
      ))}
    </>
  );
}
