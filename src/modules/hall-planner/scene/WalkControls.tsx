"use client";

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * First-person WASD + mouse-look navigation, ported from the legacy app's
 * HallCanvas3DWalk.tsx FirstPersonControls. Trimmed of the debug coordinate
 * HUD and double-click teleport (not core navigation), kept: drag-to-look,
 * WASD/arrow movement, scroll-to-move-forward, and clamping the camera to
 * stay inside the floor plan's bounds (with padding) so a guest can't walk
 * through walls or off the edge of the model.
 */
export function WalkControls({ bounds, moveSpeed = 5 }: { bounds: WalkBounds | null; moveSpeed?: number }) {
  const { camera, gl } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lookSpeed = 0.0015;

  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion);
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      euler.current.y -= dx * lookSpeed;
      euler.current.x -= dy * lookSpeed;
      const PI_2 = Math.PI / 2;
      euler.current.x = Math.max(-PI_2 + 0.1, Math.min(PI_2 - 0.1, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const delta = -(e.deltaY / 100) * 0.2;
      camera.position.addScaledVector(forward, delta);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [camera, gl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = true;
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = false;
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const moveDirRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const forward = forwardRef.current;
    const right = rightRef.current;
    const moveDir = moveDirRef.current;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    moveDir.set(0, 0, 0);
    if (moveState.current.forward) moveDir.add(forward);
    if (moveState.current.backward) moveDir.sub(forward);
    if (moveState.current.right) moveDir.add(right);
    if (moveState.current.left) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    camera.position.addScaledVector(moveDir, moveSpeed * delta);

    if (bounds) {
      const pad = 0.5;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX + pad, bounds.maxX - pad);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ + pad, bounds.maxZ - pad);
    }
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, 5);
  });

  return null;
}
