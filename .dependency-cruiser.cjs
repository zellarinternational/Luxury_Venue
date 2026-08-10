/**
 * Enforces the hall-planner module boundary from the architecture plan:
 * only src/modules/hall-planner/geometry-source/** may import dxf-viewer,
 * dxf-parser, or reference a raw .dxf path. Everything else (placement,
 * scene, the store) must depend solely on the FloorPlanGeometry type this
 * module exports — that's what makes a future native-editor swap a new
 * geometry-source implementation instead of a rewrite.
 */
module.exports = {
  forbidden: [
    {
      name: "no-dxf-outside-geometry-source",
      comment:
        "Only src/modules/hall-planner/geometry-source may import dxf-viewer/dxf-parser. Import FloorPlanGeometry from geometry-source/types instead.",
      severity: "error",
      from: {
        pathNot: "^src/modules/hall-planner/geometry-source",
      },
      to: {
        path: "^(dxf-viewer|dxf-parser)$",
      },
    },
    {
      name: "no-dxf-file-refs-outside-geometry-source",
      comment: "Raw .dxf file imports/references belong only inside geometry-source.",
      severity: "error",
      from: {
        pathNot: "^src/modules/hall-planner/geometry-source",
      },
      to: {
        path: "\\.dxf$",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
