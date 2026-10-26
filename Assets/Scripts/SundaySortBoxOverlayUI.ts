/**
 * SundaySortBoxOverlayUI — everything drawn ON the pillbox (passive view).
 *
 * Owns: the 14 cell overlays (cyan rim ring + floating count + pill icons),
 *       the MON..SUN day labels along the back edge, one progress dot per
 *       bottle, the "Week ready" banner, and the small corner tick left at the end.
 * Expects: pillbox (cell geometry), overlayMaterial (Unlit), cameraObject
 *          (labels turn to face it), tickIcon (check_circle texture).
 * Must NOT: decide anything. SundaySortMain pushes what to show through the
 *           public methods; this module holds only view state (what is visible).
 *
 * Layout note (Hard Rule 3 audit): the counts, icons and day labels are not a
 * panel — each is anchored to a physical cell/column of the tray. Their
 * positions come from SundaySortPillbox.cellCenterLocal() plus the lift
 * settings below, never from hand-picked label stacks. The one composed
 * surface here ("Week ready") is a UIKit BackPlate + FlexLayout row.
 *
 * Test-facing names: Cell_MON_AM (enabled while shown), CellCount_MON_AM (Text),
 * CellIcon_MON_AM_0..3, DayLabel_MON (Text), ProgressDot_0..4 with child
 * ProgressDotFill_0..4 (enabled when that bottle is done), WeekReady /
 * WeekReadyText, BoxCornerTick.
 */
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BOTTLES, DAY_NAMES, ROW_AM, SCENE_NAMES, cellKey} from "./SundaySortData"
import {SundaySortPillbox} from "./SundaySortPillbox"
import {buildCircleRing, buildEllipse, buildFlatRingXZ, makeVisual, pillMesh, setVisualColor} from "./SundaySortShapes"
import {CellView} from "./SundaySortState"
import {applyTextRole, setupText, sizeForDigitHeight, tintPlate, withAlpha} from "./SundaySortThemeUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

const MAX_ICONS = 4
const LIT_ICON_CM = 1.0
const CHECK_ICON_CM = 0.75
const FADE_SECONDS = 0.45
const DOT_SPACING_CM = 1.7
const COUNT_WHITE = new vec4(1, 1, 1, 1)
const DAY_DIM = new vec4(0.78, 0.8, 0.88, 0.55)
const CHECK_RING = new vec4(1, 1, 1, 0.45)
const DOT_RING = new vec4(0.9, 0.95, 1, 0.9)
const TICK_GREEN = new vec4(0.45, 1.0, 0.6, 1)

interface CellNodes {
  key: string
  day: number
  row: number
  root: SceneObject
  ring: RenderMeshVisual
  label: SceneObject
  count: Text
  icons: RenderMeshVisual[]
  iconColors: vec4[]
  ringColor: vec4
}

@component
export class SundaySortBoxOverlayUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortBoxOverlayUI – rings, counts, day labels and dots on the box</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The pillbox whose cells this overlay sits on (source of cell positions).")
  pillbox: SundaySortPillbox

  @input
  @hint("Unlit material cloned for rings, pill icons and dots.")
  overlayMaterial: Material

  @input
  @hint("Camera Object — counts and labels turn to face it.")
  cameraObject: SceneObject

  @input
  @hint("Tick icon shown on the box corner when the week is finished.")
  tickIcon: Texture
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{0.2,0.95,1.0,1}")
  @hint("Colour of the ring around a lit cell's rim (brief: bright cyan).")
  @widget(new ColorWidget())
  ringColor: vec4

  @input("vec4", "{0.35,0.97,1.0,1}")
  @hint("Colour of a day label when that day is lit.")
  @widget(new ColorWidget())
  dayLitColor: vec4

  @input
  @hint("Height of the floating count digits in cm (brief: about 2 cm).")
  @widget(new SliderWidget(1, 3.5, 0.1))
  countHeightCm: number = 2.0

  @input
  @hint("How far above the rim the evening (front row) counts float, in cm.")
  @widget(new SliderWidget(0.5, 6, 0.1))
  countLiftFrontCm: number = 1.9

  @input
  @hint("How far above the rim the morning (back row) counts float, in cm. Higher than the front row so the rows don't overlap from 60 cm.")
  @widget(new SliderWidget(0.5, 9, 0.1))
  countLiftBackCm: number = 4.3

  @input
  @hint("How far above the rim the MON..SUN labels float along the back edge, in cm.")
  @widget(new SliderWidget(1, 12, 0.1))
  dayLabelLiftCm: number = 5.5
  @ui.group_end

  private cells: {[key: string]: CellNodes} = {}
  private cellOrder: CellNodes[] = []
  private dayLabels: Text[] = []
  private dayLabelRoots: SceneObject[] = []
  private litDays: boolean[] = [false, false, false, false, false, false, false]
  private dotsRoot: SceneObject
  private dotFills: SceneObject[] = []
  private weekReadyRoot: SceneObject
  private weekReadyPlate: BackPlate
  private weekReadyWanted = false
  private cornerTick: SceneObject
  private dayLabelsRoot: SceneObject
  private cellFade: CancelFunction | null = null
  private allFade: CancelFunction | null = null
  private started = false
  private camTransform: Transform | null = null

  onAwake(): void {
    if (!this.pillbox || !this.overlayMaterial) {
      print("[SundaySortBoxOverlayUI] ERROR: pillbox / overlayMaterial not wired")
      return
    }
    if (this.cameraObject) this.camTransform = this.cameraObject.getTransform()
    this.getSceneObject().createComponent("Component.Canvas")
    this.buildCells()
    this.buildDayLabels()
    this.buildProgressDots()
    this.buildWeekReady()
    this.buildCornerTick()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public API (Main → view) ────────────────────────────────────────────────

  /** One bottle selected: light exactly these cells and brighten these days. */
  showLitCells(views: CellView[], litDays: boolean[]): void {
    this.stopCellFade()
    this.hideCells()
    for (const v of views) {
      const n = this.cells[v.key]
      if (!n) continue
      n.ringColor = this.ringColor
      setVisualColor(n.ring, this.ringColor)
      this.layoutLabel(n, v, false)
      n.root.enabled = true
    }
    this.setDayLabels(litDays)
  }

  /** Check mode: every cell shows all of its pills (icons) and the total. */
  showCheckCells(views: CellView[]): void {
    this.stopCellFade()
    this.hideCells()
    for (const v of views) {
      const n = this.cells[v.key]
      if (!n) continue
      n.ringColor = CHECK_RING
      setVisualColor(n.ring, CHECK_RING)
      this.layoutLabel(n, v, true)
      n.root.enabled = true
    }
    this.setDayLabels([false, false, false, false, false, false, false])
  }

  /** Fade the glow out (after Done), then hide the cells and dim the day labels. */
  fadeOutCells(seconds: number = FADE_SECONDS): void {
    this.stopCellFade()
    const shown = this.cellOrder.filter((n) => n.root.enabled)
    this.setDayLabels([false, false, false, false, false, false, false])
    if (shown.length === 0) return
    this.cellFade = animate({
      duration: seconds,
      easing: "ease-out-quad",
      update: (t: number) => {
        for (const n of shown) this.applyCellAlpha(n, 1 - t)
      },
      ended: () => {
        this.cellFade = null
        for (const n of shown) {
          n.root.enabled = false
          this.applyCellAlpha(n, 1)
        }
      },
    })
  }

  hideCells(): void {
    for (const n of this.cellOrder) {
      n.root.enabled = false
      this.applyCellAlpha(n, 1)
    }
  }

  /** Fill dot i when bottle i (BOTTLES order) is done. */
  setProgress(done: boolean[]): void {
    for (let i = 0; i < this.dotFills.length; i++) this.dotFills[i].enabled = done[i] === true
  }

  showWeekReady(): void {
    this.weekReadyWanted = true
    if (this.started) {
      this.weekReadyRoot.enabled = true
      this.applyPlateTint()
    }
  }

  /** End of the week: fade every overlay away and leave only the corner tick. */
  fadeOutAllExceptTick(seconds: number = 0.8): void {
    this.stopCellFade()
    if (this.allFade) this.allFade()
    const texts: Text[] = this.dayLabels.slice()
    this.allFade = animate({
      duration: seconds,
      easing: "ease-in-out-quad",
      update: (t: number) => {
        const a = 1 - t
        for (const n of this.cellOrder) if (n.root.enabled) this.applyCellAlpha(n, a)
        for (const tx of texts) tx.textFill.color = withAlpha(DAY_DIM, a)
        const s = Math.max(0.001, a)
        this.dotsRoot.getTransform().setLocalScale(new vec3(s, s, s))
        this.weekReadyRoot.getTransform().setLocalScale(new vec3(s, s, s))
      },
      ended: () => {
        this.allFade = null
        this.hideCells()
        this.dayLabelsRoot.enabled = false
        this.dotsRoot.enabled = false
        this.weekReadyWanted = false
        this.weekReadyRoot.enabled = false
        this.cornerTick.enabled = true
      },
    })
  }

  // ── State getters (for tests / Main) ───────────────────────────────────────

  get visibleCellKeys(): string[] {
    return this.cellOrder.filter((n) => n.root.enabled).map((n) => n.key)
  }

  get litDayFlags(): boolean[] {
    return this.litDays.slice()
  }

  cellCountText(key: string): string {
    const n = this.cells[key]
    return n ? n.count.text : ""
  }

  get isWeekReadyVisible(): boolean {
    return this.weekReadyRoot ? this.weekReadyRoot.enabled : false
  }

  get isCornerTickVisible(): boolean {
    return this.cornerTick ? this.cornerTick.enabled : false
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private buildCells(): void {
    const parent = this.child(this.getSceneObject(), "Cells")
    const ringMesh = buildFlatRingXZ(this.pillbox.pitchX - 0.3, this.pillbox.pitchZ - 0.3, 0.3)
    const digitSize = sizeForDigitHeight(this.countHeightCm)
    for (let row = 0; row < 2; row++) {
      for (let day = 0; day < 7; day++) {
        const key = cellKey(day, row)
        const root = this.child(parent, SCENE_NAMES.cellPrefix + key)
        const c = this.pillbox.cellCenterLocal(day, row)
        root.getTransform().setLocalPosition(new vec3(c.x, c.y + 0.06, c.z))
        const ring = makeVisual(root, SCENE_NAMES.cellRingPrefix + key, ringMesh, this.overlayMaterial, this.ringColor, true)

        const label = this.child(root, "CellLabel_" + key)
        const lift = row === ROW_AM ? this.countLiftBackCm : this.countLiftFrontCm
        label.getTransform().setLocalPosition(new vec3(0, lift, 0))

        const countSo = this.child(label, SCENE_NAMES.cellCountPrefix + key)
        const count = countSo.createComponent("Component.Text") as Text
        setupText(count, "", COUNT_WHITE, 3.0, this.countHeightCm * 1.4)
        count.size = digitSize

        const icons: RenderMeshVisual[] = []
        const iconColors: vec4[] = []
        for (let i = 0; i < MAX_ICONS; i++) {
          const icon = makeVisual(label, SCENE_NAMES.cellIconPrefix + key + "_" + i, pillMesh("oval", LIT_ICON_CM), this.overlayMaterial, COUNT_WHITE, true)
          icon.getSceneObject().enabled = false
          icons.push(icon)
          iconColors.push(COUNT_WHITE)
        }
        root.enabled = false
        const nodes: CellNodes = {key, day, row, root, ring, label, count, icons, iconColors, ringColor: this.ringColor}
        this.cells[key] = nodes
        this.cellOrder.push(nodes)
      }
    }
  }

  private buildDayLabels(): void {
    this.dayLabelsRoot = this.child(this.getSceneObject(), "DayLabels")
    const backZ = -this.pillbox.depthCm / 2 - 0.4
    for (let d = 0; d < 7; d++) {
      const c = this.pillbox.cellCenterLocal(d, ROW_AM)
      const so = this.child(this.dayLabelsRoot, SCENE_NAMES.dayLabelPrefix + DAY_NAMES[d])
      so.getTransform().setLocalPosition(new vec3(c.x, this.pillbox.rimY + this.dayLabelLiftCm, backZ))
      const t = so.createComponent("Component.Text") as Text
      setupText(t, DAY_NAMES[d], DAY_DIM, this.pillbox.pitchX, 1.4)
      t.size = sizeForDigitHeight(0.75)
      this.dayLabels.push(t)
      this.dayLabelRoots.push(so)
    }
  }

  private buildProgressDots(): void {
    this.dotsRoot = this.child(this.getSceneObject(), "ProgressDots")
    const backZ = -this.pillbox.depthCm / 2 - 0.4
    this.dotsRoot.getTransform().setLocalPosition(new vec3(0, this.pillbox.rimY + this.dayLabelLiftCm + 1.5, backZ))
    const ringMesh = buildCircleRing(0.5, 0.36)
    const fillMesh = buildEllipse(0.36, 0.36)
    const n = BOTTLES.length
    for (let i = 0; i < n; i++) {
      const dot = makeVisual(this.dotsRoot, SCENE_NAMES.progressDotPrefix + i, ringMesh, this.overlayMaterial, DOT_RING, true)
      dot.getTransform().setLocalPosition(new vec3((i - (n - 1) / 2) * DOT_SPACING_CM, 0, 0))
      const fill = makeVisual(dot.getSceneObject(), SCENE_NAMES.progressDotFillPrefix + i, fillMesh, this.overlayMaterial, BOTTLES[i].color, true)
      fill.getTransform().setLocalPosition(new vec3(0, 0, 0.01))
      fill.getSceneObject().enabled = false
      this.dotFills.push(fill.getSceneObject())
    }
  }

  private buildWeekReady(): void {
    this.weekReadyRoot = this.child(this.getSceneObject(), SCENE_NAMES.weekReady)
    this.weekReadyRoot.getTransform().setLocalPosition(new vec3(0, this.pillbox.rimY + 3.6, 0.6))
    const plateSo = this.child(this.weekReadyRoot, "WeekReadyPanel")
    this.weekReadyPlate = plateSo.createComponent(BackPlate.getTypeName()) as BackPlate
    this.weekReadyPlate.size = new vec2(13, 4)
    const content = this.child(plateSo, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const row = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = 0.6
    row.width = 13
    row.height = 4

    const iconSo = this.child(content, "WeekReadyIcon")
    const img = iconSo.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = this.tickIcon
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    mat.mainPass.baseColor = TICK_GREEN
    img.clearMaterials()
    img.addMaterial(mat)
    iconSo.getTransform().setLocalScale(new vec3(2.2, 2.2, 1))
    iconSo.createComponent(FlexItem.getTypeName())

    const textSo = this.child(content, SCENE_NAMES.weekReadyText)
    const t = textSo.createComponent("Component.Text") as Text
    setupText(t, "Week ready", COUNT_WHITE, 8, 2.4)
    applyTextRole(t, "Title2")
    textSo.createComponent(FlexItem.getTypeName())
    // FlexLayout auto-discovers FlexItem children on start (addItems() before init throws)
  }

  private buildCornerTick(): void {
    this.cornerTick = this.child(this.getSceneObject(), SCENE_NAMES.cornerTick)
    const w = this.pillbox.widthCm, d = this.pillbox.depthCm
    this.cornerTick.getTransform().setLocalPosition(new vec3(w / 2 - 0.8, this.pillbox.rimY + 1.4, -d / 2 + 0.8))
    const img = this.cornerTick.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = this.tickIcon
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    mat.mainPass.baseColor = TICK_GREEN
    img.clearMaterials()
    img.addMaterial(mat)
    this.cornerTick.getTransform().setLocalScale(new vec3(1.8, 1.8, 1))
    this.cornerTick.enabled = false
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private layoutLabel(n: CellNodes, v: CellView, checkMode: boolean): void {
    n.count.text = v.countText
    const iconCm = checkMode ? CHECK_ICON_CM : LIT_ICON_CM
    const k = Math.min(v.icons.length, MAX_ICONS)
    if (checkMode) {
      n.count.size = sizeForDigitHeight(this.countHeightCm * 0.7)
      n.count.horizontalAlignment = HorizontalAlignment.Center
      n.count.getTransform().setLocalPosition(new vec3(0, this.countHeightCm * 0.32, 0))
      const rowY = -this.countHeightCm * 0.32 - iconCm * 0.35
      const step = iconCm * 1.12
      for (let i = 0; i < MAX_ICONS; i++) {
        const icon = n.icons[i]
        const on = i < k
        icon.getSceneObject().enabled = on
        if (!on) continue
        icon.mesh = pillMesh(v.icons[i].shape, iconCm)
        n.iconColors[i] = v.icons[i].color
        setVisualColor(icon, v.icons[i].color)
        icon.getTransform().setLocalPosition(new vec3((i - (k - 1) / 2) * step, rowY, 0.02))
      }
    } else {
      // big count on the left, the pill's own icon on its right
      n.count.size = sizeForDigitHeight(this.countHeightCm)
      n.count.horizontalAlignment = HorizontalAlignment.Right
      n.count.getTransform().setLocalPosition(new vec3(-1.5 + 0.05, 0, 0))
      for (let i = 0; i < MAX_ICONS; i++) {
        const icon = n.icons[i]
        const on = i === 0 && k > 0
        icon.getSceneObject().enabled = on
        if (!on) continue
        icon.mesh = pillMesh(v.icons[0].shape, iconCm)
        n.iconColors[0] = v.icons[0].color
        setVisualColor(icon, v.icons[0].color)
        icon.getTransform().setLocalPosition(new vec3(0.25 + iconCm / 2, 0, 0.02))
      }
    }
  }

  private applyCellAlpha(n: CellNodes, a: number): void {
    setVisualColor(n.ring, withAlpha(n.ringColor, a))
    n.count.textFill.color = withAlpha(COUNT_WHITE, a)
    for (let i = 0; i < n.icons.length; i++) setVisualColor(n.icons[i], withAlpha(n.iconColors[i], a))
  }

  private setDayLabels(lit: boolean[]): void {
    for (let d = 0; d < 7; d++) {
      const on = lit[d] === true
      this.litDays[d] = on
      this.dayLabels[d].textFill.color = on ? this.dayLitColor : DAY_DIM
      const s = on ? 1.15 : 1.0
      this.dayLabelRoots[d].getTransform().setLocalScale(new vec3(s, s, s))
    }
  }

  private stopCellFade(): void {
    if (this.cellFade) {
      this.cellFade()
      this.cellFade = null
    }
  }

  private applyPlateTint(): void {
    tintPlate(this.weekReadyPlate.getSceneObject(), new vec4(0.12, 0.42, 0.3, 0.85), TICK_GREEN, 0.12)
  }

  private onUpdate(): void {
    if (!this.started) {
      // All OnStart events (BackPlate/FlexLayout init) have run before the first
      // update — only now is it safe to hide the banner (specs-build-ui G3).
      this.started = true
      this.applyPlateTint()
      this.weekReadyRoot.enabled = this.weekReadyWanted
    }
    this.faceCamera()
  }

  /** Turn every visible label toward the camera so it reads from where the user stands. */
  private faceCamera(): void {
    if (!this.camTransform) return
    const cam = this.camTransform.getWorldPosition()
    for (const n of this.cellOrder) if (n.root.enabled) this.face(n.label.getTransform(), cam)
    if (this.dayLabelsRoot.enabled) for (const so of this.dayLabelRoots) this.face(so.getTransform(), cam)
    if (this.dotsRoot.enabled) this.face(this.dotsRoot.getTransform(), cam)
    if (this.weekReadyRoot.enabled) this.face(this.weekReadyRoot.getTransform(), cam)
    if (this.cornerTick.enabled) this.face(this.cornerTick.getTransform(), cam)
  }

  private face(t: Transform, cam: vec3): void {
    const dir = cam.sub(t.getWorldPosition())
    if (dir.length < 0.001) return
    t.setWorldRotation(quat.lookAt(dir.normalize(), vec3.up()))
  }

  private child(parent: SceneObject, name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    return so
  }
}
