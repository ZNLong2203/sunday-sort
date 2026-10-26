/**
 * SundaySortShapes — code-authored geometry (MeshBuilder) for Sunday Sort.
 *
 * Owns: mesh builders for the pillbox tray (axis-aligned boxes), the flat
 *       rectangular cell ring, and the flat pill icons (oval, round, half
 *       tablet, capsule) plus the progress-dot disc/ring. Also a small helper
 *       that puts a mesh on a child SceneObject with a tinted material clone.
 * Expects: a base Material passed in by the caller (Unlit for overlays, PBR for the tray).
 * Must NOT: hold state or create Text / UIKit (those live in *UI.ts modules).
 *
 * Declared in the Phase 0 plan as code-authored geometry: the rings and counts
 * must line up with the tray's 7x2 cell grid exactly, so the tray and its
 * overlays are generated from the same numbers instead of an AI mesh.
 *
 * Winding: every triangle goes through addTri(), which checks the cross product
 * against the intended normal and flips the triangle if needed, so faces are
 * always counter-clockwise from the visible side (back-face culling safe).
 */

type V3 = [number, number, number]

interface Acc {
  verts: number[]
  idx: number[]
  count: number
}

function newAcc(): Acc {
  return {verts: [], idx: [], count: 0}
}

function pushVert(a: Acc, p: V3, n: V3): number {
  a.verts.push(p[0], p[1], p[2], n[0], n[1], n[2], 0, 0)
  return a.count++
}

function addTri(a: Acc, p0: V3, p1: V3, p2: V3, n: V3): void {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2]
  const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2]
  const cx = uy * vz - uz * vy
  const cy = uz * vx - ux * vz
  const cz = ux * vy - uy * vx
  const dot = cx * n[0] + cy * n[1] + cz * n[2]
  const i0 = pushVert(a, p0, n)
  const i1 = pushVert(a, p1, n)
  const i2 = pushVert(a, p2, n)
  if (dot >= 0) a.idx.push(i0, i1, i2)
  else a.idx.push(i0, i2, i1)
}

function addQuad(a: Acc, p0: V3, p1: V3, p2: V3, p3: V3, n: V3): void {
  addTri(a, p0, p1, p2, n)
  addTri(a, p0, p2, p3, n)
}

function finish(a: Acc): RenderMesh {
  const b = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  b.appendVerticesInterleaved(a.verts)
  b.appendIndices(a.idx)
  b.updateMesh()
  return b.getMesh()
}

export interface BoxSpec {
  cx: number
  cy: number
  cz: number
  hx: number
  hy: number
  hz: number
}

function addBox(a: Acc, s: BoxSpec): void {
  const x0 = s.cx - s.hx, x1 = s.cx + s.hx
  const y0 = s.cy - s.hy, y1 = s.cy + s.hy
  const z0 = s.cz - s.hz, z1 = s.cz + s.hz
  addQuad(a, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0])
  addQuad(a, [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0])
  addQuad(a, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0])
  addQuad(a, [x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0])
  addQuad(a, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1])
  addQuad(a, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1])
}

/** One mesh made of many axis-aligned boxes (the pillbox tray, the counter …). */
export function buildBoxes(boxes: BoxSpec[]): RenderMesh {
  const a = newAcc()
  for (const s of boxes) addBox(a, s)
  return finish(a)
}

/** Flat rectangular ring lying in the XZ plane, facing +Y (a cell rim glow). */
export function buildFlatRingXZ(outerW: number, outerD: number, thickness: number): RenderMesh {
  const a = newAcc()
  const ox = outerW / 2, oz = outerD / 2
  const ix = ox - thickness, iz = oz - thickness
  const up: V3 = [0, 1, 0]
  // back strip, front strip, left strip, right strip
  addQuad(a, [-ox, 0, -oz], [ox, 0, -oz], [ox, 0, -iz], [-ox, 0, -iz], up)
  addQuad(a, [-ox, 0, iz], [ox, 0, iz], [ox, 0, oz], [-ox, 0, oz], up)
  addQuad(a, [-ox, 0, -iz], [-ix, 0, -iz], [-ix, 0, iz], [-ox, 0, iz], up)
  addQuad(a, [ix, 0, -iz], [ox, 0, -iz], [ox, 0, iz], [ix, 0, iz], up)
  return finish(a)
}

/** Filled ellipse in the XY plane, facing +Z (oval / round pill, filled dot). */
export function buildEllipse(rx: number, ry: number, segments: number = 28): RenderMesh {
  const a = newAcc()
  const n: V3 = [0, 0, 1]
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2
    const t1 = ((i + 1) / segments) * Math.PI * 2
    addTri(a, [0, 0, 0], [Math.cos(t0) * rx, Math.sin(t0) * ry, 0], [Math.cos(t1) * rx, Math.sin(t1) * ry, 0], n)
  }
  return finish(a)
}

/** Half tablet: a semicircle with its flat edge at the bottom, centred on its box. */
export function buildHalfDisc(r: number, segments: number = 20): RenderMesh {
  const a = newAcc()
  const n: V3 = [0, 0, 1]
  const yOff = -r * 0.42 // centre the shape's bounding box on the origin
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI
    const t1 = ((i + 1) / segments) * Math.PI
    addTri(a, [0, yOff, 0], [Math.cos(t0) * r, Math.sin(t0) * r + yOff, 0], [Math.cos(t1) * r, Math.sin(t1) * r + yOff, 0], n)
  }
  return finish(a)
}

/** Capsule outline (stadium) in the XY plane, long axis on X, facing +Z. */
export function buildCapsule(length: number, radius: number, segments: number = 12): RenderMesh {
  const a = newAcc()
  const n: V3 = [0, 0, 1]
  const half = Math.max(0, length / 2 - radius)
  addQuad(a, [-half, -radius, 0], [half, -radius, 0], [half, radius, 0], [-half, radius, 0], n)
  for (let i = 0; i < segments; i++) {
    const t0 = -Math.PI / 2 + (i / segments) * Math.PI
    const t1 = -Math.PI / 2 + ((i + 1) / segments) * Math.PI
    addTri(a, [half, 0, 0], [half + Math.cos(t0) * radius, Math.sin(t0) * radius, 0], [half + Math.cos(t1) * radius, Math.sin(t1) * radius, 0], n)
    addTri(a, [-half, 0, 0], [-half - Math.cos(t0) * radius, Math.sin(t0) * radius, 0], [-half - Math.cos(t1) * radius, Math.sin(t1) * radius, 0], n)
  }
  return finish(a)
}

/** Hollow circle in the XY plane, facing +Z (an unfilled progress dot). */
export function buildCircleRing(rOuter: number, rInner: number, segments: number = 28): RenderMesh {
  const a = newAcc()
  const n: V3 = [0, 0, 1]
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2
    const t1 = ((i + 1) / segments) * Math.PI * 2
    const o0: V3 = [Math.cos(t0) * rOuter, Math.sin(t0) * rOuter, 0]
    const o1: V3 = [Math.cos(t1) * rOuter, Math.sin(t1) * rOuter, 0]
    const i0: V3 = [Math.cos(t0) * rInner, Math.sin(t0) * rInner, 0]
    const i1: V3 = [Math.cos(t1) * rInner, Math.sin(t1) * rInner, 0]
    addQuad(a, i0, o0, o1, i1, n)
  }
  return finish(a)
}

// ── Pill icon meshes, cached (one RenderMesh shared by every visual) ─────────
const pillCache: {[key: string]: RenderMesh} = {}

/** Pill icon mesh sized by `size` (cm across the long side). */
export function pillMesh(shape: string, size: number): RenderMesh {
  const key = shape + "@" + size.toFixed(2)
  if (pillCache[key]) return pillCache[key]
  let m: RenderMesh
  switch (shape) {
    case "round":
      m = buildEllipse(size * 0.42, size * 0.42)
      break
    case "half":
      m = buildHalfDisc(size * 0.5)
      break
    case "capsule":
      m = buildCapsule(size, size * 0.24)
      break
    case "oval":
    default:
      m = buildEllipse(size * 0.5, size * 0.31)
      break
  }
  pillCache[key] = m
  return m
}

/**
 * Child SceneObject + RenderMeshVisual with its own tinted material clone.
 * Overlay materials use alpha blending and do not write depth, so they can fade.
 */
export function makeVisual(
  parent: SceneObject,
  name: string,
  mesh: RenderMesh,
  baseMaterial: Material,
  color: vec4,
  overlay: boolean,
): RenderMeshVisual {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = mesh
  const mat = baseMaterial.clone()
  mat.mainPass.baseColor = color
  if (overlay) {
    mat.mainPass.blendMode = BlendMode.Normal
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
  }
  rmv.mainMaterial = mat
  return rmv
}

/** Set the colour (and alpha) of a visual created by makeVisual. */
export function setVisualColor(rmv: RenderMeshVisual, color: vec4): void {
  if (rmv && rmv.mainMaterial) rmv.mainMaterial.mainPass.baseColor = color
}
