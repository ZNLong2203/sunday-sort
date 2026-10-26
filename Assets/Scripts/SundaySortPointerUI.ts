/**
 * SundaySortPointerUI — the small arrow at the edge of the view.
 *
 * Owns: one UIKit BackPlate pill [arrow][label][arrow] that sits at the edge of
 *       the user's view on the side of a target ("1 left: Vitamin D" toward the
 *       shelf, or back toward the box). Only the arrow on the target's side is
 *       lit, and it rolls to point at the target. Placement is presentation
 *       logic, so it lives here: Main only says what to point at.
 * Expects: cameraObject (with a Camera component), arrowIcon (arrow_back).
 * Must NOT: decide WHEN to point — Main calls pointTo()/hide().
 *
 * Test-facing names: OutOfViewArrow (enabled while shown), OutOfViewArrowText.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {SCENE_NAMES} from "./SundaySortData"
import {applyTextRole, setupText, tintPlate} from "./SundaySortThemeUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

const PANEL_W = 13
const PANEL_H = 3.2
const ARROW_CM = 1.8
const TEXT_W = 8.4

@component
export class SundaySortPointerUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortPointerUI – edge-of-view arrow</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Camera Object — the arrow sits at the edge of this camera's view.")
  cameraObject: SceneObject

  @input
  @hint("Left-pointing arrow icon; it is rolled to point at the target.")
  arrowIcon: Texture
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Distance from the eyes to the arrow, in cm. Nearer than the box (~80 cm away, below) so the pill floats in the air above the counter; scale the SceneObject by distance / 60 to keep its size in view.")
  @widget(new SliderWidget(30, 120, 1))
  distanceCm: number = 50

  @input
  @hint("How close to the view edge the arrow sits (1 = right at the edge).")
  @widget(new SliderWidget(0.5, 1, 0.01))
  edgeInset: number = 0.88

  @input("vec4", "{1.0,0.86,0.35,1}")
  @hint("Arrow colour.")
  @widget(new ColorWidget())
  arrowColor: vec4

  @input("vec4", "{0.10,0.36,0.46,0.9}")
  @hint("Pill fill colour.")
  @widget(new ColorWidget())
  plateColor: vec4
  @ui.group_end

  private panel: SceneObject
  private label: Text
  private arrowL: Material
  private arrowR: Material
  private arrowLSo: SceneObject
  private arrowRSo: SceneObject
  private camTransform: Transform | null = null
  private camera: Camera | null = null
  private target: vec3 = vec3.zero()
  private besideAnchor: vec3 | null = null
  private wantVisible = false
  private started = false
  private snapNext = true
  private _side = 0

  onAwake(): void {
    if (this.cameraObject) {
      this.camTransform = this.cameraObject.getTransform()
      this.camera = this.cameraObject.getComponent("Component.Camera") as Camera
    }
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Show the arrow at the view edge toward `targetWorld`, with `text`.
   * `besideWorld` (optional, e.g. the pillbox): while it is in front of the user
   * the arrow sits at that thing's height, so it reads "just beside the box".
   */
  pointTo(targetWorld: vec3, text: string, besideWorld: vec3 | null = null): void {
    this.target = targetWorld
    this.besideAnchor = besideWorld
    if (this.label.text !== text) this.label.text = text
    if (!this.wantVisible) this.snapNext = true
    this.wantVisible = true
    if (this.started && !this.panel.enabled) {
      this.panel.enabled = true
      this.tint()
    }
  }

  hide(): void {
    this.wantVisible = false
    if (this.started) this.panel.enabled = false
  }

  get isVisible(): boolean {
    return this.started ? this.panel.enabled : this.wantVisible
  }

  get labelText(): string {
    return this.label ? this.label.text : ""
  }

  /** -1 = arrow on the left edge, +1 = right edge, 0 = hidden / not placed yet. */
  get side(): number {
    return this.isVisible ? this._side : 0
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private build(): void {
    this.panel = global.scene.createSceneObject(SCENE_NAMES.arrow)
    this.panel.setParent(this.getSceneObject())
    this.panel.createComponent("Component.Canvas")
    const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(PANEL_W, PANEL_H)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    const row = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = 0.3
    row.width = PANEL_W
    row.height = PANEL_H

    const l = this.makeArrow(content, "ArrowLeft")
    this.arrowLSo = l.so
    this.arrowL = l.mat
    const textSo = global.scene.createSceneObject(SCENE_NAMES.arrowText)
    textSo.setParent(content)
    this.label = textSo.createComponent("Component.Text") as Text
    setupText(this.label, "", new vec4(1, 1, 1, 1), TEXT_W, 2)
    applyTextRole(this.label, "Headline1")
    textSo.createComponent(FlexItem.getTypeName())
    const r = this.makeArrow(content, "ArrowRight")
    this.arrowRSo = r.so
    this.arrowR = r.mat
    // FlexLayout auto-discovers the FlexItem children on start (addItems() before init throws)
  }

  private makeArrow(parent: SceneObject, name: string): {so: SceneObject; mat: Material; item: FlexItem} {
    // The arrow image sits inside a holder so FlexLayout positions the holder
    // and the roll applied to the image never fights the layout.
    const holder = global.scene.createSceneObject(name)
    holder.setParent(parent)
    const item = holder.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = ARROW_CM
    item.overrideHeight = ARROW_CM
    const so = global.scene.createSceneObject(name + "Icon")
    so.setParent(holder)
    const img = so.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = this.arrowIcon
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    mat.mainPass.baseColor = this.arrowColor
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(ARROW_CM, ARROW_CM, 1))
    return {so, mat, item}
  }

  private tint(): void {
    tintPlate(this.panel, this.plateColor, this.arrowColor, 0.12)
  }

  private onUpdate(): void {
    if (!this.started) {
      this.started = true // BackPlate/FlexLayout have initialised (specs-build-ui G3)
      this.tint()
      this.panel.enabled = this.wantVisible
    }
    if (this.panel.enabled) this.place()
  }

  /** Put the pill at the view edge on the target's side; roll the lit arrow toward it. */
  private place(): void {
    if (!this.camTransform || !this.camera) return
    const local = this.camTransform.getInvertedWorldTransform().multiplyPoint(this.target)
    let dx = local.x
    let dy = local.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.0001) {
      dx = -1
      dy = 0
    } else {
      dx /= len
      dy /= len
    }
    const d = this.distanceCm
    const halfH = Math.tan(this.camera.fov / 2) * d * this.edgeInset
    const halfW = halfH * this.camera.aspect
    const sc = this.getTransform().getWorldScale().x // a nearer pill is scaled down to keep its size in view
    const ex = Math.max(1, halfW - (PANEL_W * sc) / 2)
    const ey = Math.max(1, halfH - (PANEL_H * sc) / 2)
    const s = 1 / Math.max(Math.abs(dx) / ex, Math.abs(dy) / ey)
    let px = dx * s
    let py = dy * s
    if (this.besideAnchor) {
      const a = this.camTransform.getInvertedWorldTransform().multiplyPoint(this.besideAnchor)
      if (a.z < -1) {
        // pin to the side edge, at the anchor's height on screen
        px = (dx < 0 ? -1 : 1) * ex
        py = Math.max(-ey, Math.min(ey, (a.y / -a.z) * d))
      }
    }
    const wanted = this.camTransform.getWorldTransform().multiplyPoint(new vec3(px, py, -d))

    const t = this.getTransform()
    if (this.snapNext) {
      t.setWorldPosition(wanted)
      this.snapNext = false
    } else {
      const k = Math.min(1, getDeltaTime() * 10)
      t.setWorldPosition(vec3.lerp(t.getWorldPosition(), wanted, k))
    }
    t.setWorldRotation(this.camTransform.getWorldRotation())

    this._side = dx < 0 ? -1 : 1
    const roll = Math.atan2(dy, dx) - Math.PI // icon points to -X at roll 0
    const leftOn = this._side < 0
    this.arrowL.mainPass.baseColor = leftOn ? this.arrowColor : new vec4(0, 0, 0, 0)
    this.arrowR.mainPass.baseColor = leftOn ? new vec4(0, 0, 0, 0) : this.arrowColor
    const q = quat.fromEulerAngles(0, 0, roll)
    this.arrowLSo.getTransform().setLocalRotation(q)
    this.arrowRSo.getTransform().setLocalRotation(q)
  }
}
