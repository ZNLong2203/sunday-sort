/**
 * SundaySortLeafHelpers — shared helpers for the Sunday Sort LEAF scenarios (test-only).
 *
 * Reads the Lens the way a user sees it: SceneObject enabled-in-hierarchy flags,
 * Text contents, material colours, mesh shapes, audio sources relative to the
 * camera. Uses the SundaySortMain public API only for setup shortcuts and
 * as secondary evidence. Never changes app behaviour.
 *
 * Interaction primitives (all LEAF):
 *  - pinch(): LeafHandInteractor (simulated SIK hand: moves to the target,
 *    makes a pinch gesture, drives SIK hover -> trigger start -> trigger end
 *    through SIK's own HandInteractor and InteractionManager).
 *  - LeafHeadTurner: LEAF's IK HeadController + PoseTransform (the same head
 *    physics IKBodyInteractor uses) applied to the Camera Object, so a test can
 *    turn the user's head in the preview.
 *  - FrameRecorder: per-frame sampling, so short effects (fades, chimes) are
 *    observed while they happen, not guessed from the end state.
 */
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {HeadController} from "Leaf.lspkg/IKSolver/HeadController"
import {PoseTransform} from "Leaf.lspkg/IKSolver/PoseTransform"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {UpdateDispatcher} from "Leaf.lspkg/Utils/common/UpdateDispatcher"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"

export const LOG_TAG = "[SundaySortLeaf]"

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
export const AM_KEYS = DAYS.map((d) => d + "_AM")
export const PM_KEYS = DAYS.map((d) => d + "_PM")
export const ALL_KEYS = AM_KEYS.concat(PM_KEYS)

export const BOTTLE_OBJECTS = [
  "Bottle_Metformin",
  "Bottle_Amlodipine",
  "Bottle_Furosemide",
  "Bottle_Atorvastatin",
  "Bottle_VitaminD",
]
export const BOTTLE_TICKS = BOTTLE_OBJECTS.map((n) => n.replace("Bottle_", "BottleTick_"))

/** Pill icon colours. The brief names them (white, yellow, light blue, pink, amber); RGB is the build's choice. */
export const PILL_COLOR = {
  white: new vec4(0.97, 0.97, 0.97, 1),
  yellow: new vec4(1.0, 0.88, 0.2, 1),
  lightBlue: new vec4(0.5, 0.82, 1.0, 1),
  pink: new vec4(1.0, 0.55, 0.78, 1),
  amber: new vec4(1.0, 0.66, 0.15, 1),
}

export function log(msg: string): void {
  print(LOG_TAG + " " + msg)
}

// ── Scene lookups ────────────────────────────────────────────────────────────

const objCache: {[name: string]: SceneObject} = {}

/** Find a SceneObject by exact name (cached for global lookups; the views are built once in onAwake). */
export function obj(name: string, root?: SceneObject): SceneObject {
  if (!root) {
    const hit = objCache[name]
    if (hit && !isNull(hit)) return hit
  }
  const so = findSceneObjectByName(name, root)
  if (!so) throw new Error(`Scene object "${name}" not found`)
  if (!root) objCache[name] = so
  return so
}

/** Visible = this object and every parent enabled. */
export function shown(name: string, root?: SceneObject): boolean {
  return obj(name, root).isEnabledInHierarchy
}

export function textComp(name: string): Text {
  const t = obj(name).getComponent("Component.Text") as Text
  if (!t) throw new Error(`"${name}" has no Text component`)
  return t
}

export function text(name: string): string {
  return textComp(name).text
}

export function meshVisual(name: string, root?: SceneObject): RenderMeshVisual {
  const r = obj(name, root).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (!r) throw new Error(`"${name}" has no RenderMeshVisual`)
  return r
}

export function audioComp(name: string): AudioComponent {
  const a = obj(name).getComponent("Component.AudioComponent") as AudioComponent
  if (!a) throw new Error(`"${name}" has no AudioComponent`)
  return a
}

export function visibleCellKeys(): string[] {
  return ALL_KEYS.filter((k) => shown("Cell_" + k))
}

export function cellCount(key: string): string {
  return text("CellCount_" + key)
}

/** The pill icons currently visible on a cell, in slot order. */
export function visibleIcons(key: string): RenderMeshVisual[] {
  const out: RenderMeshVisual[] = []
  for (let i = 0; i < 4; i++) {
    const name = "CellIcon_" + key + "_" + i
    if (shown(name)) out.push(meshVisual(name))
  }
  return out
}

export function ringAlpha(key: string): number {
  return colorOf(meshVisual("CellRing_" + key)).w
}

export function haloShown(bottleObject: string): boolean {
  return obj("BottleHalo", obj(bottleObject)).isEnabledInHierarchy
}

export function filledDots(): number[] {
  const out: number[] = []
  for (let i = 0; i < 5; i++) if (shown("ProgressDotFill_" + i)) out.push(i)
  return out
}

export function shownTicks(): string[] {
  return BOTTLE_TICKS.filter((n) => shown(n))
}

// ── Colours and shapes ───────────────────────────────────────────────────────

export function colorOf(r: MaterialMeshVisual): vec4 {
  return r.mainMaterial.mainPass.baseColor
}

export function sameRgb(a: vec4, b: vec4, eps: number = 0.02): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps
}

export function sameRgba(a: vec4, b: vec4, eps: number = 0.02): boolean {
  return sameRgb(a, b, eps) && Math.abs(a.w - b.w) < eps
}

export function fmt4(c: vec4): string {
  return `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}, ${c.w.toFixed(2)})`
}

export function fmt3(v: vec3): string {
  return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
}

/**
 * Classify a pill icon by its mesh bounds (flat mesh in XY):
 * oval h/w 0.62, round 1.0, capsule 0.48 (symmetric), half tablet 0.5 with
 * its flat edge at the bottom (bounds centre sits above the origin).
 */
export function pillShape(r: RenderMeshVisual): string {
  const m = r.mesh
  if (!m) return "none"
  const mn = m.aabbMin
  const mx = m.aabbMax
  const w = mx.x - mn.x
  const h = mx.y - mn.y
  if (!(w > 0)) return "unknown"
  const ratio = h / w
  const cy = (mx.y + mn.y) / 2 / w
  if (Math.abs(ratio - 0.5) < 0.03 && cy > 0.02) return "half"
  if (Math.abs(ratio - 0.48) < 0.03 && Math.abs(cy) < 0.01) return "capsule"
  if (Math.abs(ratio - 0.62) < 0.04 && Math.abs(cy) < 0.01) return "oval"
  if (Math.abs(ratio - 1.0) < 0.05 && Math.abs(cy) < 0.01) return "round"
  return `unknown(h/w=${ratio.toFixed(2)},cy=${cy.toFixed(3)})`
}

// ── Camera helpers ───────────────────────────────────────────────────────────

export function cameraLocal(main: SundaySortMain, world: vec3): vec3 {
  return main.cameraObject.getTransform().getInvertedWorldTransform().multiplyPoint(world)
}

export function screenPos(main: SundaySortMain, world: vec3): vec2 {
  const cam = main.cameraObject.getComponent("Component.Camera") as Camera
  return cam.worldSpaceToScreenSpace(world)
}

/** Horizontal angle of a point from the camera's forward, in degrees. Positive = to the user's LEFT. */
export function yawLeftDeg(local: vec3): number {
  return (Math.atan2(-local.x, -local.z) * 180) / Math.PI
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/** Wait until SundaySortMain has started and the runtime-built views exist. */
export async function waitForLens(timeoutMs: number = 15000): Promise<SundaySortMain> {
  const deadline = getTime() + timeoutMs / 1000
  while (getTime() < deadline) {
    const so = findSceneObjectByName("SundaySortMain")
    const main = so ? (so.getComponent(SundaySortMain.getTypeName()) as SundaySortMain) : null
    if (
      main &&
      (main as any).ready === true &&
      findSceneObjectByName("Cell_MON_AM") &&
      findSceneObjectByName("BottleCard") &&
      findSceneObjectByName("DoneButtonLabel") &&
      findSceneObjectByName("OutOfViewArrow")
    ) {
      // let the views' first UpdateEvent run (cards/arrow hide themselves there)
      await sleep(500)
      return main
    }
    await nextFrame()
  }
  throw new Error("Sunday Sort did not become ready within " + timeoutMs + " ms")
}

// ── Interaction ──────────────────────────────────────────────────────────────

/**
 * Real SIK pinch through LEAF's simulated hand: the hand moves to the target,
 * makes a pinch, and SIK fires hover -> onTriggerStart -> onTriggerEnd on the
 * target's Interactable. For UIKit buttons the Interactable sits on the button
 * object (DoneButton / UndoButton); its collider is the child "Collider".
 * LEAF targets the Interactable itself, so that child does not block it.
 */
export async function pinch(name: string, hand: "left" | "right" = "right"): Promise<void> {
  const target = findInteractableByName(name, undefined, true)
  if (!target) throw new Error(`Interactable "${name}" not found or not enabled`)
  log(`pinch [${hand} hand, SIK HandInteractor] -> ${name}`)
  await LeafHandInteractor.get(hand).trigger(target)
}

/** Fires once per frame (after the app's own UpdateEvents) and stores a snapshot. */
export class FrameRecorder<T> {
  readonly frames: {t: number; s: T}[] = []
  private unsub: (() => void) | null

  constructor(snap: () => T) {
    this.unsub = UpdateDispatcher.getInstance().onUpdate.add(() => {
      this.frames.push({t: getTime(), s: snap()})
    })
  }

  stop(): void {
    if (this.unsub) {
      this.unsub()
      this.unsub = null
    }
  }
}

/**
 * Turns the user's head (the Camera Object) with LEAF's IK HeadController —
 * the same smoothed head physics LEAF's IKBodyInteractor uses when it looks at
 * a target. The camera POSITION is left untouched; only the rotation changes.
 *
 * Preview caveat: the Camera Object's DeviceTracking rewrites the camera pose
 * at the start of every frame, before any script's UpdateEvent. A head pose
 * written from LEAF's UpdateDispatcher (which runs after the Lens's own
 * scripts) is therefore never seen by the Lens's per-frame logic. While the
 * test drives the head, DeviceTracking is paused so the turned pose persists
 * into the next frame; dispose() restores both tracking and the start rotation.
 */
export class LeafHeadTurner {
  private readonly controller = new HeadController()
  private readonly head: PoseTransform
  private readonly camT: Transform
  private readonly initialRotation: quat
  private readonly tracking: DeviceTracking | null
  private readonly trackingWasEnabled: boolean
  private unsub: (() => void) | null

  constructor(cameraObject: SceneObject) {
    this.camT = cameraObject.getTransform()
    this.head = new PoseTransform(this.camT)
    this.initialRotation = this.camT.getWorldRotation()
    this.tracking = cameraObject.getComponent("Component.DeviceTracking") as DeviceTracking
    this.trackingWasEnabled = this.tracking ? this.tracking.enabled : false
    if (this.tracking) {
      this.tracking.enabled = false
      log("head turner: DeviceTracking paused while LEAF drives the head (restored on dispose)")
    }
    this.unsub = UpdateDispatcher.getInstance().onUpdate.add(() => {
      const dt = getDeltaTime()
      if (!(dt > 0)) return
      const pose = this.controller.update(dt, this.head.toPose())
      if (pose !== undefined) this.head.apply(pose)
    })
  }

  /** Angle in degrees between the camera's forward (-Z) and the direction to `target`. */
  angleTo(target: vec3): number {
    const pos = this.camT.getWorldPosition()
    const to = target.sub(pos).normalize()
    const fwd = this.camT.getWorldRotation().multiplyVec3(vec3.back())
    const d = Math.max(-1, Math.min(1, fwd.dot(to)))
    return (Math.acos(d) * 180) / Math.PI
  }

  /** Turn the head toward `target`; resolves with the remaining error in degrees. */
  async lookAt(target: vec3, timeoutMs: number = 4000, toleranceDeg: number = 2): Promise<number> {
    this.controller.setTarget(target)
    const deadline = getTime() + timeoutMs / 1000
    while (getTime() < deadline) {
      await nextFrame()
      const err = this.angleTo(target)
      if (err <= toleranceDeg) {
        // hold for a few frames so the app's per-frame guidance sees the settled pose
        for (let i = 0; i < 3; i++) await nextFrame()
        return this.angleTo(target)
      }
    }
    return this.angleTo(target)
  }

  /** Stop driving the head, put the camera back where it started, resume DeviceTracking. */
  dispose(): void {
    if (this.unsub) {
      this.unsub()
      this.unsub = null
    }
    this.camT.setWorldRotation(this.initialRotation)
    if (this.tracking && !isNull(this.tracking)) this.tracking.enabled = this.trackingWasEnabled
  }
}

/** Collects named check results so a scenario can report every failure at once, then throw. */
export class CheckList {
  private readonly failures: string[] = []
  private readonly passes: string[] = []

  constructor(private readonly scenarioId: string) {}

  check(ok: boolean, what: string, actual: string, expected: string): void {
    if (ok) {
      this.passes.push(what)
      log(`${this.scenarioId} PASS ${what} — actual: ${actual}`)
    } else {
      const line = `${what} — expected: ${expected} — actual: ${actual}`
      this.failures.push(line)
      log(`${this.scenarioId} FAIL ${line}`)
    }
  }

  note(msg: string): void {
    log(`${this.scenarioId} NOTE ${msg}`)
  }

  /** Fail through LEAF's expect() with every failed check listed. */
  finish(): void {
    log(`${this.scenarioId} summary: ${this.passes.length} passed, ${this.failures.length} failed`)
    expect(this.failures.length, `${this.failures.length} check(s) failed:\n - ` + this.failures.join("\n - ")).toBe(0)
  }
}
