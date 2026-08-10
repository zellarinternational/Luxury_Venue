import * as THREE from "three";

export interface DxfBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface LoadedDxfScene {
  object: THREE.Object3D;
  bounds: DxfBounds;
  /**
   * dxf-viewer internally shifts all geometry by this reference point (for
   * WebGL float precision on large real-world coordinates) — the returned
   * `object`'s children are already positioned in `rawDxfCoord - origin`
   * space. Anything placed alongside this scene using raw DXF-unit
   * coordinates (table/door/stage positions from the DB) MUST subtract this
   * same origin, or it will end up offset from the visual drawing.
   */
  origin: { x: number; y: number };
}

const sceneCache = new Map<string, LoadedDxfScene>();
const loadingPromises = new Map<string, Promise<LoadedDxfScene>>();

function createHiddenContainer(): HTMLDivElement {
  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;left:-9999px;top:0;width:2px;height:2px;overflow:hidden;visibility:hidden;pointer-events:none;";
  document.body.appendChild(div);
  return div;
}

function disableToneMapping(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const mat of Array.isArray(material) ? material : [material]) {
      (mat as THREE.MeshBasicMaterial).toneMapped = false;
    }
  });
}

/**
 * Loads and parses a DXF file into a reusable Three.js scene graph, using
 * dxf-viewer's offscreen-WebGL parse-then-extract pattern (ported from the
 * old repo's advancedDxfRenderer.tsx, which proved this approach works well
 * for real architectural floor-plan files). Results are cached per URL.
 *
 * This is the ONLY module in the app allowed to import dxf-viewer — enforced
 * by .dependency-cruiser.cjs. Everything else consumes the resulting
 * THREE.Object3D via DxfFloorPlanVisual, never dxf-viewer's types directly.
 */
export async function loadDxfScene(url: string): Promise<LoadedDxfScene> {
  const cached = sceneCache.get(url);
  if (cached) return cached;

  const inFlight = loadingPromises.get(url);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<LoadedDxfScene> => {
    let container: HTMLDivElement | null = null;
    try {
      const { DxfViewer } = await import("dxf-viewer");
      container = createHiddenContainer();

      const viewer = new DxfViewer(container, {
        canvasWidth: 2,
        canvasHeight: 2,
        autoResize: false,
        clearColor: new THREE.Color("#ffffff"),
        clearAlpha: 1,
        blackWhiteInversion: true,
        colorCorrection: false,
        retainParsedDxf: false,
      });

      if (!viewer.HasRenderer()) throw new Error("WebGL renderer not available for DXF parsing");

      const loadUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
      await viewer.Load({ url: loadUrl, fonts: null, workerFactory: null });

      const scene = viewer.GetScene();
      const origin = viewer.GetOrigin();
      const viewerBounds = viewer.GetBounds();

      const group = new THREE.Group();
      for (const child of scene.children) {
        group.add(child.clone(true));
      }
      disableToneMapping(group);

      const bounds: DxfBounds = viewerBounds
        ? { minX: viewerBounds.minX, maxX: viewerBounds.maxX, minY: viewerBounds.minY, maxY: viewerBounds.maxY }
        : { minX: 0, maxX: 1, minY: 0, maxY: 1 };

      // Leave the group at dxf-viewer's native (origin-relative) position —
      // no extra recentering. Scene code aligns markers to it via `origin`.
      viewer.Destroy();
      container.remove();

      const result: LoadedDxfScene = { object: group, bounds, origin };
      sceneCache.set(url, result);
      return result;
    } catch (err) {
      container?.remove();
      throw err;
    } finally {
      loadingPromises.delete(url);
    }
  })();

  loadingPromises.set(url, promise);
  return promise;
}
