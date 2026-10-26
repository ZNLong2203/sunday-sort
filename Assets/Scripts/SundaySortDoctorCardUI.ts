/**
 * SundaySortDoctorCardUI — the "Doctor's change" card beside the box (stretch).
 *
 * Owns: one big pinchable card (a UIKit Button, so it highlights when aimed at)
 *       with a title row ("Doctor's change") and a short note row. The card
 *       turns to face the camera while it is visible.
 * Expects: cameraObject. Lives on its own authored SceneObject beside the box;
 *          the card itself is the runtime child "DoctorChangeCard", whose
 *          enabled flag is its visibility and which holds the SIK Interactable.
 * Must NOT: decide what the change means — it only emits onPinched; Main calls
 *           show()/hide().
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {DOSE_CHANGE, SCENE_NAMES} from "./SundaySortData"
import {applyTextRole, setupText} from "./SundaySortThemeUI"

// Prism body is centred on the card (front face at +depth/2) and pushes forward
// up to 0.3 cm on hover; the text sits in front of that so the glass never hides it.
const PRISM_DEPTH = 1
const LABEL_Z = PRISM_DEPTH / 2 + 0.3 + 0.1
const LABEL_DISTANCE_CM = 70 // lift labels in front of the button face (specs-build-ui gotcha)
const PAD = 0.8
const TITLE_H = 1.8
const NOTE_H = 1.3
const ROW_GAP = 0.3

@component
export class SundaySortDoctorCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortDoctorCardUI – "Doctor\'s change" card beside the box (stretch)</span>')
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
  @hint("Card width in cm (a big target: one easy pinch).")
  @widget(new SliderWidget(8, 20, 0.5))
  cardWidthCm: number = 12

  @input("vec4", "{1.0,0.62,0.2,1}")
  @hint("Title colour (orange, the colour of the change).")
  @widget(new ColorWidget())
  titleColor: vec4
  @ui.group_end

  private _onPinched = new Event<void>()
  private card: SceneObject
  private title: Text
  private note: Text
  private wantVisible = false
  private started = false
  private camTransform: Transform | null = null

  get onPinched(): PublicApi<void> {
    return this._onPinched.publicApi()
  }

  onAwake(): void {
    if (this.cameraObject) this.camTransform = this.cameraObject.getTransform()
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  show(): void {
    this.wantVisible = true
    if (this.started) this.card.enabled = true
  }

  hide(): void {
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
    this.getSceneObject().createComponent("Component.Canvas")
    const h = PAD * 2 + TITLE_H + ROW_GAP + NOTE_H
    this.card = global.scene.createSceneObject(SCENE_NAMES.doctorCard)
    this.card.setParent(this.getSceneObject())
    const button = this.card.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS3", style: "Prism"})
    button.size = new vec3(this.cardWidthCm, h, PRISM_DEPTH)
    button.onTriggerUp.add(() => this._onPinched.invoke())

    const content = global.scene.createSceneObject(SCENE_NAMES.doctorCard + "Content")
    content.setParent(this.card)
    content.getTransform().setLocalPosition(new vec3(0, 0, LABEL_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = ROW_GAP
    flex.width = this.cardWidthCm
    flex.height = h
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD

    this.title = this.addRow(content, SCENE_NAMES.doctorCardTitle, TITLE_H, DOSE_CHANGE.cardTitle, this.titleColor)
    applyTextRole(this.title, "HeadlineXL", LABEL_DISTANCE_CM)
    this.note = this.addRow(content, SCENE_NAMES.doctorCardNote, NOTE_H, DOSE_CHANGE.cardNote, new vec4(1, 1, 1, 1))
    applyTextRole(this.note, "Subheadline", LABEL_DISTANCE_CM)
    // FlexLayout auto-discovers the FlexItem children on start (addItems() before init throws)
  }

  private addRow(parent: SceneObject, name: string, h: number, text: string, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    setupText(t, text, color, 1, 1) // 1x1 placeholder; the column's Stretch gives full width
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = h
    return t
  }

  /** Parallel to the view (shares the camera's rotation), so it stays level from any head pitch. */
  private faceCamera(): void {
    if (!this.camTransform) return
    this.getTransform().setWorldRotation(this.camTransform.getWorldRotation())
  }

  private onUpdate(): void {
    if (!this.started) {
      // Button/FlexLayout initialise on OnStart; hide only after that (specs-build-ui G3).
      this.started = true
      this.card.enabled = this.wantVisible
    }
    if (this.card.enabled) this.faceCamera()
  }
}
