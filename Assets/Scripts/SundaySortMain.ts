/**
 * SundaySortMain — the Sunday Sort controller (one place for the core logic).
 *
 * Owns: the session (SundaySortState), and turns state changes into view calls:
 *       select a bottle → lit cells + day labels + card; Done → fade glow,
 *       chime, dot, tick, hide card; Undo → clear selection; check mode →
 *       every cell's pills + total and "All checked"; finish → "Week ready"
 *       for N s, then everything fades except the corner tick. Also decides
 *       when the edge arrow shows (out-of-view Vitamin D nudge with one spatial
 *       chime, or "turn back" when a bottle is selected and the box is out of view).
 * Expects (all wired by the scene bootstrap): the pillbox, the four UI modules,
 *       the audio module, the five bottles and the Camera Object.
 * Must NOT: build UI or text itself — views are driven only through their public methods.
 *
 * Public API for tests (LEAF) and debugging:
 *   selectBottle(id) / done() / undo() / allChecked()
 *   selectedBottleId, doneBottleIds, mode, pointerMode,
 *   nudgeChimeCount, doneChimeCount, weekReadyChimeCount, isInView(worldPos)
 * Bottle ids: metformin, amlodipine, furosemide, atorvastatin, vitaminD.
 */
import {BOTTLES, BottleDef, bottleById} from "./SundaySortData"
import {SundaySortAudio} from "./SundaySortAudio"
import {SundaySortBottle} from "./SundaySortBottle"
import {SundaySortBottleCardUI} from "./SundaySortBottleCardUI"
import {SundaySortBoxOverlayUI} from "./SundaySortBoxOverlayUI"
import {SundaySortControlsUI} from "./SundaySortControlsUI"
import {SundaySortPillbox} from "./SundaySortPillbox"
import {SundaySortPointerUI} from "./SundaySortPointerUI"
import {SundaySortState} from "./SundaySortState"

const GLOW_FADE_SECONDS = 0.45

@component
export class SundaySortMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortMain – Sunday Sort controller</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The pillbox stand-in (cell geometry, 'is the box in view').")
  pillbox: SundaySortPillbox

  @input
  @hint("Overlay drawn on the box: rings, counts, day labels, dots, Week ready.")
  overlay: SundaySortBoxOverlayUI

  @input
  @hint("Card shown above the pinched bottle.")
  card: SundaySortBottleCardUI

  @input
  @hint("Done / Undo buttons.")
  controls: SundaySortControlsUI

  @input
  @hint("Edge-of-view arrow.")
  pointer: SundaySortPointerUI

  @input
  @hint("Chimes.")
  audio: SundaySortAudio

  @input
  @hint("Metformin bottle.")
  bottleMetformin: SundaySortBottle

  @input
  @hint("Amlodipine bottle.")
  bottleAmlodipine: SundaySortBottle

  @input
  @hint("Furosemide bottle.")
  bottleFurosemide: SundaySortBottle

  @input
  @hint("Atorvastatin bottle.")
  bottleAtorvastatin: SundaySortBottle

  @input
  @hint("Vitamin D bottle (on the shelf to the left).")
  bottleVitaminD: SundaySortBottle

  @input
  @hint("Camera Object — used to tell what is in view.")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("How long 'Week ready' stays on the box before everything fades, in seconds.")
  @widget(new SliderWidget(1, 8, 0.5))
  weekReadySeconds: number = 3

  @input
  @hint("Nudge text when only the out-of-view bottle is left. {name} is replaced by the bottle's short name.")
  nudgeTemplate: string = "1 left: {name}"

  @input
  @hint("Arrow text when a bottle is selected and the box is out of view.")
  turnBackLabel: string = "Back to the box"

  @input
  @hint("Screen-edge margin (fraction of the view) a point must be inside to count as 'in view'.")
  @widget(new SliderWidget(0, 0.3, 0.01))
  viewMargin: number = 0.05

  @input
  @hint("Debug: draw every collider as a wireframe (takes effect on preview restart).")
  debugColliders: boolean = false
  @ui.group_end

  private state = new SundaySortState()
  private bottles: {[id: string]: SundaySortBottle} = {}
  private camTransform: Transform | null = null
  private camera: Camera | null = null
  private nudgeChimed = false
  private _pointerMode = "none"
  private pendingGen = 0
  private ready = false

  onAwake(): void {
    const missing: string[] = []
    const req: [string, any][] = [
      ["pillbox", this.pillbox],
      ["overlay", this.overlay],
      ["card", this.card],
      ["controls", this.controls],
      ["pointer", this.pointer],
      ["audio", this.audio],
      ["bottleMetformin", this.bottleMetformin],
      ["bottleAmlodipine", this.bottleAmlodipine],
      ["bottleFurosemide", this.bottleFurosemide],
      ["bottleAtorvastatin", this.bottleAtorvastatin],
      ["bottleVitaminD", this.bottleVitaminD],
      ["cameraObject", this.cameraObject],
    ]
    for (const [name, v] of req) if (!v) missing.push(name)
    if (missing.length > 0) {
      print("[SundaySortMain] ERROR: inputs not wired: " + missing.join(", "))
      return
    }
    this.bottles = {
      metformin: this.bottleMetformin,
      amlodipine: this.bottleAmlodipine,
      furosemide: this.bottleFurosemide,
      atorvastatin: this.bottleAtorvastatin,
      vitaminD: this.bottleVitaminD,
    }
    this.camTransform = this.cameraObject.getTransform()
    this.camera = this.cameraObject.getComponent("Component.Camera") as Camera

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.updateGuidance())
  }

  private onStart(): void {
    for (const id in this.bottles) this.bottles[id].onPinched.add((bid: string) => this.selectBottle(bid))
    this.controls.onDone.add(() => this.done())
    this.controls.onUndo.add(() => this.undo())
    this.overlay.setProgress(BOTTLES.map(() => false))
    this.controls.setAllCheckedMode(false)
    this.controls.setUndoActive(false)
    if (this.debugColliders) this.setColliderDebugAll(true)
    this.ready = true
    print("[SundaySortMain] ready — pinch a bottle to start")
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Pinching a bottle (stands in for reading its label). */
  selectBottle(id: string): boolean {
    if (!this.ready) return false
    const def = bottleById(id)
    if (!def || !this.state.select(id)) return false
    this.pendingGen++ // cancel a pending "show check view"
    this.overlay.showLitCells(this.state.cellsForBottle(id), this.state.litDays(id))
    this.card.showCard(def.displayName, def.cardNote, this.bottles[id].topWorld())
    for (const bid in this.bottles) this.bottles[bid].setSelected(bid === id)
    this.controls.setAllCheckedMode(false)
    this.controls.setUndoActive(true)
    print("[SundaySortMain] selected " + id)
    return true
  }

  /** The big button: Done while a bottle is selected, "All checked" in check mode. */
  done(): string {
    if (!this.ready) return "not-ready"
    if (this.state.selected !== null) {
      const id = this.state.markDone()
      if (id === null) return "noop"
      this.overlay.fadeOutCells(GLOW_FADE_SECONDS)
      this.audio.playDone()
      this.overlay.setProgress(BOTTLES.map((b) => this.state.isDone(b.id)))
      this.bottles[id].setDone(true)
      this.bottles[id].setSelected(false)
      this.card.hideCard()
      this.controls.setUndoActive(false)
      if (this.state.mode === "checking") {
        this.controls.setAllCheckedMode(true)
        this.afterDelay(GLOW_FADE_SECONDS + 0.05, () => this.showCheckView())
      }
      print("[SundaySortMain] done " + id + " (" + this.state.doneIds().length + "/" + BOTTLES.length + ")")
      return "done:" + id
    }
    if (this.state.mode === "checking") return this.allChecked() ? "finished" : "noop"
    return "noop"
  }

  /** Clear a wrong selection without marking anything done. */
  undo(): boolean {
    if (!this.ready) return false
    const id = this.state.clearSelection()
    if (id === null) return false
    this.overlay.fadeOutCells(0.2)
    this.card.hideCard()
    this.bottles[id].setSelected(false)
    this.controls.setUndoActive(false)
    if (this.state.mode === "checking") {
      this.controls.setAllCheckedMode(true)
      this.afterDelay(0.25, () => this.showCheckView())
    }
    print("[SundaySortMain] undo " + id)
    return true
  }

  /** Finish the week (check mode, nothing selected). */
  allChecked(): boolean {
    if (!this.ready || !this.state.finishWeek()) return false
    this.pendingGen++
    this.audio.playWeekReady()
    this.overlay.fadeOutCells(0.3)
    this.overlay.showWeekReady()
    this.controls.setUndoActive(false)
    this.pointer.hide()
    for (const bid in this.bottles) this.bottles[bid].setAttract(false)
    this.afterDelay(this.weekReadySeconds, () => {
      this.overlay.fadeOutAllExceptTick()
      this.controls.fadeOut()
      for (const bid in this.bottles) this.bottles[bid].finish()
    })
    print("[SundaySortMain] week ready")
    return true
  }

  get selectedBottleId(): string {
    return this.state.selected === null ? "" : this.state.selected
  }

  get doneBottleIds(): string[] {
    return this.state.doneIds()
  }

  get mode(): string {
    return this.state.mode
  }

  /** "none" | "nudge" | "turnBack" — what the edge arrow is doing right now. */
  get pointerMode(): string {
    return this._pointerMode
  }

  get nudgeChimeCount(): number {
    return this.audio ? this.audio.playCount("nudge") : 0
  }

  get doneChimeCount(): number {
    return this.audio ? this.audio.playCount("done") : 0
  }

  get weekReadyChimeCount(): number {
    return this.audio ? this.audio.playCount("weekReady") : 0
  }

  /** True when a world point is in front of the camera and inside the view (minus the margin). */
  isInView(worldPos: vec3): boolean {
    if (!this.camTransform || !this.camera) return true
    const local = this.camTransform.getInvertedWorldTransform().multiplyPoint(worldPos)
    if (local.z > -1) return false
    const s = this.camera.worldSpaceToScreenSpace(worldPos)
    const m = this.viewMargin
    return s.x >= m && s.x <= 1 - m && s.y >= m && s.y <= 1 - m
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private showCheckView(): void {
    if (this.state.mode !== "checking" || this.state.selected !== null) return
    this.overlay.showCheckCells(this.state.cellsForCheck())
  }

  /** Edge arrow + nudge chime: decided every frame from state + what is in view. */
  private updateGuidance(): void {
    if (!this.ready || this.state.mode === "finished") return
    const shelf = this.shelfBottleDef()
    const shelfBottle = shelf ? this.bottles[shelf.id] : null
    let mode = "none"

    if (this.state.selected !== null) {
      const box = this.pillbox.topCenterWorld()
      if (!this.isInView(box)) {
        mode = "turnBack"
        this.pointer.pointTo(box, this.turnBackLabel)
      }
      if (shelfBottle) shelfBottle.setAttract(false)
    } else if (this.state.mode === "sorting" && shelf && shelfBottle && this.onlyShelfBottleLeft(shelf)) {
      const p = shelfBottle.centerWorld()
      if (!this.isInView(p)) {
        mode = "nudge"
        this.pointer.pointTo(p, this.nudgeTemplate.replace("{name}", shelf.shortName), this.pillbox.topCenterWorld())
        shelfBottle.setAttract(false)
        if (!this.nudgeChimed) {
          // one soft chime only — it never nags
          this.nudgeChimed = true
          this.audio.playNudge()
          print("[SundaySortMain] nudge: " + shelf.shortName + " is out of view")
        }
      } else {
        shelfBottle.setAttract(true)
      }
    } else if (shelfBottle) {
      shelfBottle.setAttract(false)
    }

    if (mode === "none") this.pointer.hide()
    this._pointerMode = mode
  }

  private shelfBottleDef(): BottleDef | null {
    for (const b of BOTTLES) if (b.onShelf) return b
    return null
  }

  private onlyShelfBottleLeft(shelf: BottleDef): boolean {
    const rem = this.state.remaining()
    return rem.length === 1 && rem[0].id === shelf.id
  }

  private afterDelay(seconds: number, fn: () => void): void {
    const gen = ++this.pendingGen
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      if (gen === this.pendingGen) fn()
    })
    ev.reset(seconds)
  }

  /** Hard Rule 6.7: one toggle wireframes every collider in the scene. */
  private setColliderDebugAll(on: boolean): void {
    const walk = (so: SceneObject) => {
      const cols = so.getComponents("Physics.ColliderComponent") as ColliderComponent[]
      for (const c of cols) c.debugDrawEnabled = on
      for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
    }
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) walk(global.scene.getRootObject(i))
  }
}
