/**
 * SundaySortBottleCardUI — the small card that pops up just above a pinched bottle.
 *
 * Owns: one UIKit BackPlate card with a title row ("Found: Metformin 500 mg")
 *       and an optional note row ("½ tablet — split before you start"). The
 *       card turns to face the camera while it is visible.
 * Expects: cameraObject. Lives on its own authored SceneObject; the card itself
 *          is the runtime child "BottleCard", whose enabled flag is its visibility.
 * Must NOT: know about bottles or state — Main calls showCard()/hideCard().
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {SCENE_NAMES} from "./SundaySortData"
import {applyTextRole, setupText, tintPlate} from "./SundaySortThemeUI"

const PAD = 1.0
const TITLE_H = 1.8
const NOTE_H = 1.5
const ROW_GAP = 0.35

@component
export class SundaySortBottleCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortBottleCardUI – "Found: …" card above the pinched bottle</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Camera Object — the card turns to face it.")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Text placed before the bottle name on the card.")
  titlePrefix: string = "Found: "

  @input
  @hint("Card width in cm.")
  @widget(new SliderWidget(8, 24, 0.5))
  cardWidthCm: number = 13.5

  @input
  @hint("Gap between the top of the bottle and the bottom of the card, in cm.")
  @widget(new SliderWidget(0, 8, 0.1))
  cardLiftCm: number = 1.8

  @input("vec4", "{0.10,0.36,0.46,0.9}")
  @hint("Card fill. Mid-bright teal so white text still contrasts on the additive display.")
  @widget(new ColorWidget())
  plateColor: vec4

  @input("vec4", "{0.3,0.95,1.0,1}")
  @hint("Card border colour.")
  @widget(new ColorWidget())
  borderColor: vec4

  @input("vec4", "{1.0,0.86,0.4,1}")
  @hint("Colour of the second line (e.g. the half-tablet instruction).")
  @widget(new ColorWidget())
  noteColor: vec4
  @ui.group_end

  private card: SceneObject
  private plate: BackPlate
  private flex: FlexLayout
  private title: Text
  private note: Text
  private noteItem: FlexItem
  private wantVisible = false
  private started = false
  private anchor: vec3 = vec3.zero()
  private camTransform: Transform | null = null

  onAwake(): void {
    if (this.cameraObject) this.camTransform = this.cameraObject.getTransform()
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Show the card just above `anchorWorld` (the top centre of the bottle). */
  showCard(name: string, note: string, anchorWorld: vec3): void {
    this.title.text = this.titlePrefix + name
    this.note.text = note
    const hasNote = note.length > 0
    this.noteItem.overrideHeight = hasNote ? NOTE_H : 0
    const h = PAD * 2 + TITLE_H + (hasNote ? ROW_GAP + NOTE_H : 0)
    this.flex.height = h
    this.plate.size = new vec2(this.cardWidthCm, h)
    this.anchor = anchorWorld.add(new vec3(0, this.cardLiftCm + h / 2, 0))
    this.wantVisible = true
    this.place()
    if (this.started) {
      this.card.enabled = true
      this.tint()
    }
  }

  hideCard(): void {
    this.wantVisible = false
    if (this.started) this.card.enabled = false
  }

  get isVisible(): boolean {
    return this.started ? this.card.enabled : this.wantVisible
  }

  get titleText(): string {
    return this.title ? this.title.text : ""
  }

  get noteText(): string {
    return this.note ? this.note.text : ""
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private build(): void {
    this.card = global.scene.createSceneObject(SCENE_NAMES.card)
    this.card.setParent(this.getSceneObject())
    this.card.createComponent("Component.Canvas")
    this.plate = this.card.createComponent(BackPlate.getTypeName()) as BackPlate
    this.plate.size = new vec2(this.cardWidthCm, PAD * 2 + TITLE_H)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.card)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    this.flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.flex.direction = FlexDirection.Column
    this.flex.alignItems = FlexAlign.Stretch
    this.flex.justifyContent = FlexJustify.Center
    this.flex.rowGap = ROW_GAP
    this.flex.width = this.cardWidthCm
    this.flex.height = PAD * 2 + TITLE_H
    this.flex.paddingTop = PAD
    this.flex.paddingBottom = PAD
    this.flex.paddingLeft = PAD
    this.flex.paddingRight = PAD

    this.title = this.addRow(content, SCENE_NAMES.cardTitle, TITLE_H, new vec4(1, 1, 1, 1))
    applyTextRole(this.title, "HeadlineXL", 78) // ~1.3x the 60 cm scale: the card is read at a glance
    this.note = this.addRow(content, SCENE_NAMES.cardNote, NOTE_H, this.noteColor)
    applyTextRole(this.note, "Headline2", 74)
    this.noteItem = this.note.getSceneObject().getComponent(FlexItem.getTypeName()) as FlexItem
    this.noteItem.overrideHeight = 0
  }

  private addRow(parent: SceneObject, name: string, h: number, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    setupText(t, "", color, 1, 1) // 1x1 placeholder; the column's Stretch gives full width
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = h
    return t
  }

  private tint(): void {
    tintPlate(this.card, this.plateColor, this.borderColor, 0.12)
  }

  private place(): void {
    const t = this.getTransform()
    if (!this.camTransform) {
      t.setWorldPosition(this.anchor)
      return
    }
    const cam = this.camTransform.getWorldPosition()
    const toCam = cam.sub(this.anchor).normalize()
    // nudge 1.5 cm toward the viewer so the card never clips into the bottle
    t.setWorldPosition(this.anchor.add(toCam.uniformScale(1.5)))
    t.setWorldRotation(quat.lookAt(toCam, vec3.up()))
  }

  private onUpdate(): void {
    if (!this.started) {
      // BackPlate/FlexLayout initialise on OnStart; hide only after that (specs-build-ui G3).
      this.started = true
      this.tint()
      this.card.enabled = this.wantVisible
    }
    if (this.card.enabled) this.place()
  }
}
