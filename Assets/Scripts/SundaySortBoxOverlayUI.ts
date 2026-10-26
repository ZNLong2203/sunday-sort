/**
 * SundaySortBoxOverlayUI — everything drawn ON the pillbox (passive view).
 *
 * Owns: the 14 cell overlays (cyan rim ring + floating count + pill icons),
 *       the MON..SUN day labels and one progress dot per bottle in the strip
 *       along the back edge, the "Week ready" banner, the small corner tick left
 *       at the end, and (stretch) the pulsing orange cells + "-1 amlodipine"
 *       label of the doctor's change.
 * Viewpoint: the user stands at the counter and looks DOWN at the box (~60°).
 *       Every label faces the eyes and floats just above its own cell, so from
 *       that view it stays inside the cell and never crosses a bottle.
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
 * WeekReadyText, BoxCornerTick, DoseChangeLabel (Text).
 */
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BOTTLES, DAY_NAMES, DOSE_CHANGE, ROW_AM, SCENE_NAMES, cellKey} from "./SundaySortData"
import {SundaySortPillbox} from "./SundaySortPillbox"
import {buildCircleRing, buildEllipse, buildFlatRingXZ, makeVisual, pillMesh, setVisualColor} from "./SundaySortShapes"
import {CellView} from "./SundaySortState"
import {applyTextRole, outlineText, setupText, sizeForDigitHeight, tintPlate, withAlpha} from "./SundaySortThemeUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

const MAX_ICONS = 4
const LIT_ICON_CM = 1.15
const LIT_ICON_GAP_CM = 0.12
const CHECK_ICON_CM = 0.8
const CHECK_STACK_DROP_CM = 0.4
const FADE_SECONDS = 0.45
const DOT_SPACING_CM = 1.3
const DOT_RADIUS_CM = 0.4
const DAY_LABEL_DIGIT_CM = 0.8
const WEEK_READY_LIFT_CM = 2.0 // just above the box: read on the box itself, inside its outline from above
// "-1 amlodipine" sits on the counter just in front of the box, under the changed
// days: from above, anything floating over the back row would run into the bottles.
const DOSE_LABEL_FRONT_CM = 2.2
const DOSE_LABEL_HEIGHT_CM = 1.0 // above the counter (the tray's base)
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
  countColor: vec4
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
  @hint("Height of the floating count digits in cm. ~1.6 cm reads from ~80 cm and, with its icon, fits a 3 cm cell.")
  @widget(new SliderWidget(1, 3.5, 0.1))
  countHeightCm: number = 1.6

  @input
  @hint("How far above the rim the evening (front row) counts float, in cm. Looked at from above, ~1.3 cm keeps each count inside its own cell.")
  @widget(new SliderWidget(0.5, 4, 0.1))
  countLiftFrontCm: number = 1.3

  @input
  @hint("How far above the rim the morning (back row) counts float, in cm. Keep it low so, from above, the count never reaches the bottles behind the box.")
  @widget(new SliderWidget(0.5, 4, 0.1))
  countLiftBackCm: number = 1.3

  @input
  @hint("Height of the centre of the MON..SUN labels above the back edge, in cm.")
  @widget(new SliderWidget(0.1, 2, 0.05))
  dayLabelLiftCm: number = 0.35

  @input
  @hint("How far behind the back wall the MON..SUN labels sit, in cm (on the edge, facing up toward the user).")
  @widget(new SliderWidget(0, 2, 0.05))
  dayLabelBackCm: number = 0.5

  @input
  @hint("Height of the centre of the progress dots above the back edge, in cm.")
  @widget(new SliderWidget(0.2, 1.6, 0.05))
  dotLiftCm: number = 0.45

  @input
  @hint("How far behind the back wall the progress dots sit, in cm (behind the day labels, in front of the bottles).")
  @widget(new SliderWidget(0.5, 3, 0.05))
  dotBackCm: number = 1.7

  @input("vec4", "{1.0,0.55,0.12,1}")
  @hint("Doctor's change: colour of the pulsing rings, counts and label (bright orange).")
  @widget(new ColorWidget())
  doseChangeColor: vec4
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
  private doseLabel: Text
  private dosePulsing = false
  private dosePulseT = 0
  private doseFade: CancelFunction | null = null
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
    this.buildDoseChangeLabel()
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
      n.countColor = COUNT_WHITE
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
      n.countColor = COUNT_WHITE
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
      n.ring.getTransform().setLocalScale(vec3.one())
    }
  }

  /**
   * Stretch — the doctor's change: only these cells pulse orange with "-1" and
   * the changed bottle's icon, their day labels brighten, and one
   * "-1 amlodipine" label floats over them. The corner tick hides until Done.
   */
  showDoseChangeCells(views: CellView[], days: boolean[]): void {
    this.stopCellFade()
    this.stopDoseFade()
    this.hideCells()
    for (const v of views) {
      const n = this.cells[v.key]
      if (!n) continue
      n.ringColor = this.doseChangeColor
      n.countColor = this.doseChangeColor
      setVisualColor(n.ring, this.doseChangeColor)
      this.layoutLabel(n, v, false)
      n.count.textFill.color = this.doseChangeColor
      n.root.enabled = true
    }
    this.dayLabelsRoot.enabled = true
    this.setDayLabels(days, this.doseChangeColor)
    this.doseLabel.textFill.color = this.doseChangeColor
    outlineText(this.doseLabel)
    this.doseLabel.getSceneObject().enabled = true
    this.cornerTick.enabled = false
    this.dosePulseT = 0
    this.dosePulsing = true
  }

  /** Doctor's change finished (Done) or cancelled (Undo): fade it out, put the corner tick back. */
  endDoseChange(seconds: number = FADE_SECONDS): void {
    this.stopCellFade()
    this.stopDoseFade()
    this.dosePulsing = false
    const shown = this.cellOrder.filter((n) => n.root.enabled)
    for (const n of shown) n.ring.getTransform().setLocalScale(vec3.one())
    const texts: Text[] = this.dayLabels.slice()
    const startColors = texts.map((t) => t.textFill.color)
    this.doseFade = animate({
      duration: seconds,
      easing: "ease-out-quad",
      update: (t: number) => {
        const a = 1 - t
        for (const n of shown) this.applyCellAlpha(n, a)
        for (let i = 0; i < texts.length; i++) texts[i].textFill.color = withAlpha(startColors[i], a)
        this.doseLabel.textFill.color = withAlpha(this.doseChangeColor, a)
        outlineText(this.doseLabel, a)
      },
      ended: () => {
        this.doseFade = null
        this.hideCells()
        this.doseLabel.getSceneObject().enabled = false
        this.dayLabelsRoot.enabled = false
        this.cornerTick.enabled = true
      },
    })
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

  get isDoseChangeLabelVisible(): boolean {
    return this.doseLabel ? this.doseLabel.getSceneObject().enabled : false
  }

  get doseChangeLabelText(): string {
    return this.doseLabel ? this.doseLabel.text : ""
  }

  get isDoseChangePulsing(): boolean {
    return this.dosePulsing
  }

  /** Current ring colour of a cell (alpha included) — for tests. */
  cellRingColor(key: string): vec4 {
    const n = this.cells[key]
    return n ? n.ringColor : new vec4(0, 0, 0, 0)
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
        outlineText(count)

        const icons: RenderMeshVisual[] = []
        const iconColors: vec4[] = []
        for (let i = 0; i < MAX_ICONS; i++) {
          const icon = makeVisual(label, SCENE_NAMES.cellIconPrefix + key + "_" + i, pillMesh("oval", LIT_ICON_CM), this.overlayMaterial, COUNT_WHITE, true)
          icon.getSceneObject().enabled = false
          icons.push(icon)
          iconColors.push(COUNT_WHITE)
        }
        root.enabled = false
        const nodes: CellNodes = {key, day, row, root, ring, label, count, icons, iconColors, ringColor: this.ringColor, countColor: COUNT_WHITE}
        this.cells[key] = nodes
        this.cellOrder.push(nodes)
      }
    }
  }

  private buildDayLabels(): void {
    this.dayLabelsRoot = this.child(this.getSceneObject(), "DayLabels")
    const backZ = -this.pillbox.depthCm / 2 - this.dayLabelBackCm
    for (let d = 0; d < 7; d++) {
      const c = this.pillbox.cellCenterLocal(d, ROW_AM)
      const so = this.child(this.dayLabelsRoot, SCENE_NAMES.dayLabelPrefix + DAY_NAMES[d])
      so.getTransform().setLocalPosition(new vec3(c.x, this.pillbox.rimY + this.dayLabelLiftCm, backZ))
      const t = so.createComponent("Component.Text") as Text
      setupText(t, DAY_NAMES[d], DAY_DIM, this.pillbox.pitchX, 1.0)
      t.size = sizeForDigitHeight(DAY_LABEL_DIGIT_CM)
      this.dayLabels.push(t)
      this.dayLabelRoots.push(so)
    }
  }

  private buildProgressDots(): void {
    this.dotsRoot = this.child(this.getSceneObject(), "ProgressDots")
    const backZ = -this.pillbox.depthCm / 2 - this.dotBackCm
    this.dotsRoot.getTransform().setLocalPosition(new vec3(0, this.pillbox.rimY + this.dotLiftCm, backZ))
    const ringMesh = buildCircleRing(DOT_RADIUS_CM, DOT_RADIUS_CM * 0.72)
    const fillMesh = buildEllipse(DOT_RADIUS_CM * 0.72, DOT_RADIUS_CM * 0.72)
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
    this.weekReadyRoot.getTransform().setLocalPosition(new vec3(0, this.pillbox.rimY + WEEK_READY_LIFT_CM, 0.6))
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

  /** One "-1 amlodipine" label on the counter just in front of the box, centred under the changed days. */
  private buildDoseChangeLabel(): void {
    const so = this.child(this.getSceneObject(), SCENE_NAMES.doseChangeLabel)
    let x = 0
    for (const c of DOSE_CHANGE.cells) x += this.pillbox.cellCenterLocal(c.day, c.row).x / DOSE_CHANGE.cells.length
    so.getTransform().setLocalPosition(new vec3(x, DOSE_LABEL_HEIGHT_CM, this.pillbox.depthCm / 2 + DOSE_LABEL_FRONT_CM))
    this.doseLabel = so.createComponent("Component.Text") as Text
    setupText(this.doseLabel, DOSE_CHANGE.label, this.doseChangeColor, 12, 1.6)
    this.doseLabel.size = sizeForDigitHeight(1.0)
    outlineText(this.doseLabel)
    so.enabled = false
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private layoutLabel(n: CellNodes, v: CellView, checkMode: boolean): void {
    n.count.text = v.countText
    const iconCm = checkMode ? CHECK_ICON_CM : LIT_ICON_CM
    const k = Math.min(v.icons.length, MAX_ICONS)
    if (checkMode) {
      n.count.size = sizeForDigitHeight(this.countHeightCm * 0.7)
      n.count.horizontalAlignment = HorizontalAlignment.Center
      // the total + icon stack is taller than a lit count: drop it so, from above, it stays inside the cell
      n.count.getTransform().setLocalPosition(new vec3(0, this.countHeightCm * 0.32 - CHECK_STACK_DROP_CM, 0))
      const rowY = -this.countHeightCm * 0.32 - iconCm * 0.35 - CHECK_STACK_DROP_CM
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
      // big count, then the pill's own icon on its right — the pair centred on its own cell
      n.count.size = sizeForDigitHeight(this.countHeightCm)
      n.count.horizontalAlignment = HorizontalAlignment.Center
      const textW = this.textWidthCm(n.count, this.countHeightCm)
      const groupW = textW + LIT_ICON_GAP_CM + iconCm
      n.count.getTransform().setLocalPosition(new vec3(-groupW / 2 + textW / 2, 0, 0))
      for (let i = 0; i < MAX_ICONS; i++) {
        const icon = n.icons[i]
        const on = i === 0 && k > 0
        icon.getSceneObject().enabled = on
        if (!on) continue
        icon.mesh = pillMesh(v.icons[0].shape, iconCm)
        n.iconColors[0] = v.icons[0].color
        setVisualColor(icon, v.icons[0].color)
        icon.getTransform().setLocalPosition(new vec3(groupW / 2 - iconCm / 2, 0, 0.02))
      }
    }
  }

  /**
   * Rendered width of a count, in cm: the laid-out character bounds when the
   * text engine has them, else an estimate ("½" is about twice a digit's width).
   */
  private textWidthCm(t: Text, digitHeightCm: number): number {
    const bb = t.getBoundingBox()
    const w = bb ? bb.right - bb.left : 0
    if (w > 0.01) return w
    const em = digitHeightCm / 0.7
    let units = 0
    for (const ch of t.text) units += ch === "½" ? 1.1 : ch === "-" ? 0.4 : 0.56
    return units * em
  }

  private applyCellAlpha(n: CellNodes, a: number): void {
    setVisualColor(n.ring, withAlpha(n.ringColor, a))
    n.count.textFill.color = withAlpha(n.countColor, a)
    outlineText(n.count, a)
    for (let i = 0; i < n.icons.length; i++) setVisualColor(n.icons[i], withAlpha(n.iconColors[i], a))
  }

  private setDayLabels(lit: boolean[], litColor: vec4 = this.dayLitColor): void {
    for (let d = 0; d < 7; d++) {
      const on = lit[d] === true
      this.litDays[d] = on
      this.dayLabels[d].textFill.color = on ? litColor : DAY_DIM
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
    if (this.dosePulsing) this.pulseDoseCells()
    this.faceCamera()
  }

  /** Orange rings breathe (alpha + a little scale) so the changed cells read at a glance. */
  private pulseDoseCells(): void {
    this.dosePulseT += getDeltaTime()
    const k = 0.5 + 0.5 * Math.sin(this.dosePulseT * 4.2)
    const a = 0.35 + 0.65 * k
    const s = 1 + 0.12 * k
    for (const n of this.cellOrder) {
      if (!n.root.enabled) continue
      setVisualColor(n.ring, withAlpha(n.ringColor, a))
      n.ring.getTransform().setLocalScale(new vec3(s, 1, s))
    }
  }

  private stopDoseFade(): void {
    if (this.doseFade) {
      this.doseFade()
      this.doseFade = null
    }
  }

  /**
   * Turn every visible label to face the user's eyes. They share the view's
   * rotation (parallel to the view, not each aimed at the eye on its own), so
   * from above the counts and day labels stay level instead of fanning out.
   */
  private faceCamera(): void {
    if (!this.camTransform) return
    const rot = this.camTransform.getWorldRotation()
    for (const n of this.cellOrder) if (n.root.enabled) n.label.getTransform().setWorldRotation(rot)
    if (this.dayLabelsRoot.enabled) for (const so of this.dayLabelRoots) so.getTransform().setWorldRotation(rot)
    if (this.dotsRoot.enabled) this.dotsRoot.getTransform().setWorldRotation(rot)
    if (this.weekReadyRoot.enabled) this.weekReadyRoot.getTransform().setWorldRotation(rot)
    if (this.cornerTick.enabled) this.cornerTick.getTransform().setWorldRotation(rot)
    if (this.doseLabel.getSceneObject().enabled) this.doseLabel.getTransform().setWorldRotation(rot)
  }

  private child(parent: SceneObject, name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    return so
  }
}
