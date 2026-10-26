/**
 * SundaySortLayoutChecks — screen-space layout checks for the Sunday Sort LEAF
 * scenarios (test-only). Everything is projected with the Lens camera from
 * the current head pose (the looking-down pose in every scenario).
 *
 * Footprints:
 *  - cells:   CellRing_* mesh bounds (MeshBuilder ring, exact) through its world transform
 *  - icons:   CellIcon_* / ProgressDot_* mesh bounds (exact)
 *  - text:    Text.getBoundingBox() (local cm, the same call the overlay uses
 *             to centre a lit pair) through the text's world transform
 *  - UIKit:   Button / BackPlate `size` box (see screenRectOf)
 *  - bottles: the bottle's pinch-target box (colliderSizeCm), a little larger than the bottle
 * Overhang is reported in cm at the cell's distance: the ring's known width
 * divided by its on-screen width gives cm per screen unit (y uses the aspect).
 */
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  ALL_KEYS,
  CheckList,
  DAYS,
  ScreenRect,
  fmtRect,
  meshVisual,
  obj,
  rectsOverlap,
  screenPos,
  screenRectOf,
  screenRectOfBox,
  screenRectOfVisual,
  shown,
  textComp,
} from "./SundaySortLeafHelpers"

/**
 * Text.getBoundingBox() returns the LINE box: its height is the font's full
 * line height (ascender + descender space), not the ink. Measured on the
 * counts: a 1.6 cm digit ("1", countHeightCm 1.6) has a 2.85 cm line box, so
 * digits / capitals fill ≈ 0.56 of it, centred (baseline offset ≈ 0.05 cm).
 * "ink" mode keeps the line box's width and shrinks its height to that glyph
 * height around its centre; "line" mode is the raw line box (use it for text
 * with descenders, e.g. "-1 amlodipine").
 */
export const INK_HEIGHT_OF_LINE_BOX = 0.56

/** Screen rect of a Text ("ink" = digit/capital glyph height, "line" = full line box), or null when it has no extent yet. */
export function textRect(main: SundaySortMain, name: string, mode: "ink" | "line" = "ink"): ScreenRect | null {
  const t = textComp(name)
  const bb = t.getBoundingBox()
  if (!bb || !(bb.right - bb.left > 0.001) || !(bb.top - bb.bottom > 0.001)) return null
  let bottom = bb.bottom
  let top = bb.top
  if (mode === "ink") {
    const mid = (bb.top + bb.bottom) / 2
    const half = ((bb.top - bb.bottom) * INK_HEIGHT_OF_LINE_BOX) / 2
    bottom = mid - half
    top = mid + half
  }
  const m = t.getTransform().getWorldTransform()
  const r: ScreenRect = {minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity}
  for (const x of [bb.left, bb.right])
    for (const y of [bottom, top]) {
      const s = screenPos(main, m.multiplyPoint(new vec3(x, y, 0)))
      r.minX = Math.min(r.minX, s.x)
      r.maxX = Math.max(r.maxX, s.x)
      r.minY = Math.min(r.minY, s.y)
      r.maxY = Math.max(r.maxY, s.y)
    }
  return r
}

export function cellRect(main: SundaySortMain, key: string): ScreenRect {
  return screenRectOfVisual(main, meshVisual("CellRing_" + key))
}

export function union(rs: ScreenRect[]): ScreenRect {
  return {
    minX: Math.min(...rs.map((r) => r.minX)),
    maxX: Math.max(...rs.map((r) => r.maxX)),
    minY: Math.min(...rs.map((r) => r.minY)),
    maxY: Math.max(...rs.map((r) => r.maxY)),
  }
}

/** cm per screen unit (x, y) at a cell's distance, from the ring's known world width. */
export function cmPerScreen(main: SundaySortMain, key: string): {x: number; y: number} {
  const ring = meshVisual("CellRing_" + key)
  const m = ring.mesh
  const widthCm = (m.aabbMax.x - m.aabbMin.x) * ring.getTransform().getWorldScale().x
  const r = cellRect(main, key)
  const x = widthCm / (r.maxX - r.minX)
  const cam = main.cameraObject.getComponent("Component.Camera") as Camera
  return {x, y: x / cam.aspect}
}

/** Largest distance (cm) that `inner` sticks out of `outer`, 0 when fully inside. */
export function overhangCm(inner: ScreenRect, outer: ScreenRect, k: {x: number; y: number}): number {
  const ox = Math.max(0, outer.minX - inner.minX, inner.maxX - outer.maxX) * k.x
  const oy = Math.max(0, outer.minY - inner.minY, inner.maxY - outer.maxY) * k.y
  return Math.max(ox, oy)
}

export interface Footprint {
  name: string
  r: ScreenRect
}

export function bottleFootprints(main: SundaySortMain): Footprint[] {
  return [main.bottleMetformin, main.bottleAmlodipine, main.bottleFurosemide, main.bottleAtorvastatin].map((b) => ({
    name: b.getSceneObject().name,
    r: screenRectOfBox(main, b.getTransform(), b.colliderSizeCm),
  }))
}

export function buttonFootprints(main: SundaySortMain): Footprint[] {
  return ["DoneButton", "UndoButton"].map((n) => ({name: n, r: screenRectOf(main, n)}))
}

export function cellFootprints(main: SundaySortMain): Footprint[] {
  return ALL_KEYS.map((k) => ({name: "Cell_" + k, r: cellRect(main, k)}))
}

/** Pairs (a × b) whose screen rects overlap. */
export function overlaps(as: Footprint[], bs: Footprint[]): string[] {
  const out: string[] = []
  for (const a of as) for (const b of bs) if (rectsOverlap(a.r, b.r)) out.push(`${a.name}×${b.name}`)
  return out
}

/** Every visible count text and icon, by cell (lit or check mode). */
export function cellContents(main: SundaySortMain, key: string, mode: "ink" | "line" = "ink"): Footprint[] {
  const out: Footprint[] = []
  const t = textRect(main, "CellCount_" + key, mode)
  if (t && shown("CellCount_" + key)) out.push({name: "CellCount_" + key, r: t})
  for (let i = 0; i < 4; i++) {
    const n = "CellIcon_" + key + "_" + i
    if (shown(n)) out.push({name: n, r: screenRectOfVisual(main, meshVisual(n))})
  }
  return out
}

/**
 * Lit / check mode: each shown cell's count and icons must stay inside that
 * cell's own rect. `tolFor(key)` is the allowed overhang in cm.
 * Returns the largest overhang seen (cm) and the cell it was on.
 */
export function checkContentsInsideCells(
  c: CheckList,
  main: SundaySortMain,
  keys: string[],
  label: string,
  tolFor: (key: string) => number,
): {maxCm: number; where: string} {
  let maxCm = 0
  let where = "-"
  const bad: string[] = []
  for (const key of keys) {
    const items = cellContents(main, key)
    if (items.length === 0) {
      bad.push(`${key}: nothing measurable`)
      continue
    }
    const cell = cellRect(main, key)
    const k = cmPerScreen(main, key)
    for (const it of items) {
      const o = overhangCm(it.r, cell, k)
      if (o > maxCm) {
        maxCm = o
        where = it.name
      }
      if (o > tolFor(key)) bad.push(`${it.name} sticks out ${o.toFixed(2)} cm (allowed ${tolFor(key).toFixed(2)})`)
    }
  }
  let lineMax = 0
  for (const key of keys) {
    const t = textRect(main, "CellCount_" + key, "line")
    if (t) lineMax = Math.max(lineMax, overhangCm(t, cellRect(main, key), cmPerScreen(main, key)))
  }
  c.note(`${label}: largest overhang ${maxCm.toFixed(2)} cm (${where}) using glyph-height text boxes; with full text line boxes the counts would stick out up to ${lineMax.toFixed(2)} cm`)
  c.check(bad.length === 0, `${label}: counts and icons stay inside their own cells`, bad.length ? JSON.stringify(bad) : `max overhang ${maxCm.toFixed(2)} cm`, "within tolerance")
  return {maxCm, where}
}

/** Shown counts, icons, day labels and dots must not overlap any bottle's pinch-target rect. */
export function checkOverlayClearOfBottles(c: CheckList, main: SundaySortMain, label: string, assert: boolean = true): void {
  const items: Footprint[] = []
  for (const key of ALL_KEYS) if (shown("Cell_" + key)) items.push(...cellContents(main, key))
  for (const d of DAYS) {
    const n = "DayLabel_" + d
    if (!shown(n)) continue
    const r = textRect(main, n)
    if (r) items.push({name: n, r})
  }
  for (let i = 0; i < 5; i++) {
    const n = "ProgressDot_" + i
    if (shown(n)) items.push({name: n, r: screenRectOfVisual(main, meshVisual(n))})
  }
  const bottles = bottleFootprints(main)
  const hits = overlaps(items, bottles)
  const lowestBottle = Math.max(...bottles.map((b) => b.r.maxY))
  const highestOverlay = Math.min(...items.map((x) => x.r.minY))
  c.note(`${label}: ${items.length} overlay items checked; bottles' lowest screen edge y ${lowestBottle.toFixed(3)}, overlay's highest edge y ${highestOverlay.toFixed(3)}`)
  if (assert) {
    c.check(hits.length === 0, `${label}: no count, icon, day label or dot overlaps a bottle`, hits.length ? JSON.stringify(hits) : "no overlaps", "no overlaps")
  } else {
    c.note(`${label} (logged, not asserted): overlay items over a bottle: ${hits.length ? JSON.stringify(hits) : "none"}`)
  }
}

export function checkButtonsClearOfCells(c: CheckList, main: SundaySortMain): void {
  const buttons = buttonFootprints(main)
  for (const b of buttons) c.note(`${b.name} screen rect ${fmtRect(b.r)}`)
  const hits = overlaps(buttons, cellFootprints(main))
  c.check(hits.length === 0, "Done/Undo cover no cell on screen", hits.length ? JSON.stringify(hits) : "no overlaps", "no overlaps")
}

/** A card (UIKit object name) must not overlap any counter bottle. */
export function checkCardClearOfBottles(c: CheckList, main: SundaySortMain, cardName: string, label: string, assert: boolean = true): void {
  const r = screenRectOf(main, cardName)
  const hits = overlaps([{name: cardName, r}], bottleFootprints(main))
  c.note(`${label}: ${cardName} screen rect ${fmtRect(r)}`)
  // How deep is each overlap, in cm at the bottle (bottle pinch-target width / its screen width)?
  const cam = main.cameraObject.getComponent("Component.Camera") as Camera
  const bottles = [main.bottleMetformin, main.bottleAmlodipine, main.bottleFurosemide, main.bottleAtorvastatin]
  for (const b of bottles) {
    const br = screenRectOfBox(main, b.getTransform(), b.colliderSizeCm)
    if (!rectsOverlap(r, br)) continue
    const kx = b.colliderSizeCm.x / (br.maxX - br.minX)
    const ky = kx / cam.aspect
    const dy = (Math.min(r.maxY, br.maxY) - Math.max(r.minY, br.minY)) * ky
    const dx = (Math.min(r.maxX, br.maxX) - Math.max(r.minX, br.minX)) * kx
    c.note(`${label}: ${cardName} overlaps ${b.getSceneObject().name} by ${dy.toFixed(2)} cm vertically × ${dx.toFixed(2)} cm horizontally (bottle pinch-target rect ${fmtRect(br)}; the target box is 0.1 cm taller and wider than the bottle)`)
  }
  if (assert) {
    c.check(hits.length === 0, `${label}: ${cardName} overlaps no bottle`, hits.length ? JSON.stringify(hits) : "no overlaps", "no overlaps")
  } else {
    c.note(`${label} (logged here, asserted in c5-doctors-change): ${cardName} over a bottle: ${hits.length ? JSON.stringify(hits) : "none"}`)
  }
}

/** Debug aid: the raw Text bounding box (local cm) of a label, for the log. */
export function describeText(name: string): string {
  const t = textComp(name)
  const bb = t.getBoundingBox()
  const s = obj(name).getTransform().getWorldScale()
  return bb ? `"${t.text}" bbox ${(bb.right - bb.left).toFixed(2)} × ${(bb.top - bb.bottom).toFixed(2)} (local), world scale ${s.x.toFixed(2)}` : `"${t.text}" no bbox`
}
