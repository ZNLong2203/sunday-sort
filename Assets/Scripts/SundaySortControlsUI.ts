/**
 * SundaySortControlsUI — the big Done button and the smaller Undo next to it.
 *
 * Owns: two UIKit Buttons in a FlexLayout row ([Undo] [Done]) lying on the
 *       counter in front of the box's right half, facing up toward the user
 *       (the authored SceneObject carries the tilt). From above they sit below
 *       the box and never cover a cell. Done reads "All checked" in check mode
 *       (same spot).
 * Expects: icon textures (check, done_all, undo).
 * Must NOT: decide what Done/Undo mean — it only emits onDone / onUndo.
 *
 * Test-facing names: DoneButton, UndoButton (each holds the SIK Interactable),
 * DoneButtonLabel (Text: "Done" | "All checked"), UndoButtonLabel.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {SCENE_NAMES} from "./SundaySortData"
import {TextRole, applyTextRole, setupText} from "./SundaySortThemeUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

const LABEL_Z = 0.08
// The SnapOS3 Prism body is centred on the button (front face at +depth/2) and
// pushes forward up to 0.3 cm on hover; content must sit in front of that or the
// glass hides it depending on draw order.
const PRISM_DEPTH = 1
const PRISM_LABEL_Z = PRISM_DEPTH / 2 + 0.3 + 0.1
const LABEL_DISTANCE_CM = 70 // lift labels in front of the button face (specs-build-ui gotcha)
const DONE_H = 4.6
const UNDO_H = 3.2

interface ButtonParts {
  button: Button
  label: Text
  iconMat: Material
}

@component
export class SundaySortControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortControlsUI – Done / Undo at the box corner</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Icon on the Done button.")
  doneIcon: Texture

  @input
  @hint("Icon on the button while it reads 'All checked'.")
  allCheckedIcon: Texture

  @input
  @hint("Icon on the Undo button.")
  undoIcon: Texture
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Done button label while sorting.")
  doneLabel: string = "Done"

  @input
  @hint("Same button's label in check mode.")
  allCheckedLabel: string = "All checked"

  @input
  @hint("Undo button label.")
  undoLabel: string = "Undo"

  @input
  @hint("Done button width in cm (brief: about 8 cm — one easy pinch).")
  @widget(new SliderWidget(5, 12, 0.5))
  doneWidthCm: number = 8

  @input
  @hint("Undo button width in cm (smaller than Done).")
  @widget(new SliderWidget(3, 8, 0.5))
  undoWidthCm: number = 5

  @input
  @hint("Gap between Undo and Done, in cm.")
  @widget(new SliderWidget(0.3, 4, 0.1))
  buttonGapCm: number = 1.2
  @ui.group_end

  private _onDone = new Event<void>()
  private _onUndo = new Event<void>()
  private row: SceneObject
  private done: ButtonParts
  private undo: ButtonParts
  private allCheckedMode = false
  private fade: CancelFunction | null = null

  get onDone(): PublicApi<void> {
    return this._onDone.publicApi()
  }

  get onUndo(): PublicApi<void> {
    return this._onUndo.publicApi()
  }

  onAwake(): void {
    this.getSceneObject().createComponent("Component.Canvas")
    this.row = global.scene.createSceneObject("ControlsRow")
    this.row.setParent(this.getSceneObject())
    const flex = this.row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Row
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.End
    flex.columnGap = this.buttonGapCm
    flex.width = this.doneWidthCm + this.undoWidthCm + this.buttonGapCm
    flex.height = DONE_H

    this.undo = this.makeButton(this.row, SCENE_NAMES.undoButton, this.undoWidthCm, UNDO_H, this.undoIcon, 1.3, this.undoLabel, "Headline1", "Primary")
    this.done = this.makeButton(this.row, SCENE_NAMES.doneButton, this.doneWidthCm, DONE_H, this.doneIcon, 1.7, this.doneLabel, "HeadlineXL", "Prism")
    this.done.label.getSceneObject().name = SCENE_NAMES.doneLabel
    this.undo.label.getSceneObject().name = "UndoButtonLabel"
    // FlexLayout auto-discovers the FlexItem children on start (addItems() before init throws)

    this.done.button.onTriggerUp.add(() => this._onDone.invoke())
    this.undo.button.onTriggerUp.add(() => this._onUndo.invoke())
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** false → "Done", true → "All checked" (same button, same spot). */
  setAllCheckedMode(on: boolean): void {
    this.allCheckedMode = on
    this.done.label.text = on ? this.allCheckedLabel : this.doneLabel
    this.done.iconMat.mainPass.baseTex = on ? this.allCheckedIcon : this.doneIcon
  }

  /** Undo only does something while a bottle is selected; dim it otherwise. */
  setUndoActive(active: boolean): void {
    this.undo.label.textFill.color = active ? new vec4(1, 1, 1, 1) : new vec4(1, 1, 1, 0.45)
    this.undo.iconMat.mainPass.baseColor = active ? new vec4(1, 1, 1, 1) : new vec4(1, 1, 1, 0.45)
  }

  /** Bring the buttons back after fadeOut() (the doctor's change needs Done again). */
  show(): void {
    if (this.fade) {
      this.fade()
      this.fade = null
    }
    this.row.enabled = true
    this.row.getTransform().setLocalScale(vec3.one())
  }

  get isShown(): boolean {
    return this.row ? this.row.enabled : false
  }

  /** End of the week: shrink the buttons away and disable them. */
  fadeOut(seconds: number = 0.8): void {
    if (this.fade) this.fade()
    const t = this.row.getTransform()
    this.fade = animate({
      duration: seconds,
      easing: "ease-in-out-quad",
      update: (k: number) => {
        const s = Math.max(0.001, 1 - k)
        t.setLocalScale(new vec3(s, s, s))
      },
      ended: () => {
        this.fade = null
        this.row.enabled = false
      },
    })
  }

  get primaryLabel(): string {
    return this.done ? this.done.label.text : ""
  }

  get isAllCheckedMode(): boolean {
    return this.allCheckedMode
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private makeButton(
    parent: SceneObject,
    name: string,
    w: number,
    h: number,
    icon: Texture,
    iconCm: number,
    label: string,
    role: TextRole,
    style: string,
  ): ButtonParts {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const button = so.createComponent(Button.getTypeName()) as Button
    button.setVariant({theme: "SnapOS3", style: style})
    button.size = new vec3(w, h, PRISM_DEPTH)
    so.createComponent(FlexItem.getTypeName())

    const content = global.scene.createSceneObject(name + "Content")
    content.setParent(so)
    content.getTransform().setLocalPosition(new vec3(0, 0, style === "Prism" ? PRISM_LABEL_Z : LABEL_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Row
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.columnGap = 0.5
    flex.width = w
    flex.height = h

    const iconSo = global.scene.createSceneObject(name + "Icon")
    iconSo.setParent(content)
    const img = iconSo.createComponent("Component.Image") as Image
    const iconMat = imageMaterial.clone()
    iconMat.mainPass.baseTex = icon
    iconMat.mainPass.depthTest = true
    iconMat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(iconMat)
    iconSo.getTransform().setLocalScale(new vec3(iconCm, iconCm, 1))
    iconSo.createComponent(FlexItem.getTypeName())

    const textSo = global.scene.createSceneObject(name + "Label")
    textSo.setParent(content)
    const t = textSo.createComponent("Component.Text") as Text
    const labelW = Math.max(1, w - iconCm - 1.0)
    setupText(t, label, new vec4(1, 1, 1, 1), labelW, 2.0)
    applyTextRole(t, role, LABEL_DISTANCE_CM) // a touch larger than the 60 cm default: big, easy target
    textSo.createComponent(FlexItem.getTypeName())

    return {button, label: t, iconMat}
  }
}
