/**
 * SundaySortBottle — one pill bottle. The bottle IS the button.
 *
 * Owns: the pinch target on this bottle (box collider + SIK Interactable on
 *       this unit-scale, unrotated SceneObject, centred on the bottle mesh —
 *       Hard Rule 6.2), the aim highlight (halo ring + small grow), the gentle
 *       "come here" pulse for the out-of-view bottle, and the done tick.
 * Expects: bottleId, visual (wrapper around the bottle GLB, origin at the
 *          bottle's base), tickIcon, overlayMaterial, cameraObject.
 * Must NOT: change session state — it only emits onPinched(bottleId).
 *
 * Stand-in: pinching the bottle stands in for the glasses reading its label.
 * Test-facing: this SceneObject is "Bottle_<Name>" and holds the Interactable;
 * the tick is "BottleTick_<Name>" (enabled when the bottle is done).
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {SCENE_NAMES, bottleById} from "./SundaySortData"
import {buildCircleRing, makeVisual, setVisualColor} from "./SundaySortShapes"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const TICK_GREEN = new vec4(0.45, 1.0, 0.6, 1)

@component
export class SundaySortBottle extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortBottle – pinch target, highlight and tick for one bottle</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Which bottle in the sample schedule this is.")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Metformin 500 mg", "metformin"),
      new ComboBoxItem("Amlodipine 5 mg", "amlodipine"),
      new ComboBoxItem("Furosemide 20 mg", "furosemide"),
      new ComboBoxItem("Atorvastatin 20 mg", "atorvastatin"),
      new ComboBoxItem("Vitamin D", "vitaminD"),
    ]),
  )
  bottleId: string = "metformin"

  @input
  @hint("Wrapper SceneObject around the bottle mesh (origin at the bottle's base). It grows slightly when aimed at.")
  visual: SceneObject

  @input
  @hint("Tick icon shown on the bottle once it is done.")
  tickIcon: Texture

  @input
  @hint("Unlit material for the highlight halo.")
  overlayMaterial: Material

  @input
  @hint("Camera Object — the tick turns to face it.")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{4.6,8.2,4.6}")
  @hint("Pinch target size in cm: tight to the 4.5 x 8 cm bottle so it never catches a pinch meant for a neighbour.")
  colliderSizeCm: vec3

  @input("vec4", "{0.2,0.95,1.0,1}")
  @hint("Colour of the halo shown when the bottle is aimed at or selected.")
  @widget(new ColorWidget())
  highlightColor: vec4

  @input
  @hint("How much the bottle grows while aimed at (1 = no change).")
  @widget(new SliderWidget(1, 1.3, 0.01))
  hoverScale: number = 1.07
  @ui.group_end

  private _onPinched = new Event<string>()
  private interactable: Interactable
  private collider: ColliderComponent
  private halo: RenderMeshVisual
  private tick: SceneObject
  private camTransform: Transform | null = null
  private hovered = false
  private selected = false
  private attract = false
  private done = false
  private halfHeight = 4
  private pulseT = 0
  private fade: CancelFunction | null = null

  get onPinched(): PublicApi<string> {
    return this._onPinched.publicApi()
  }

  onAwake(): void {
    const so = this.getSceneObject()
    if (!bottleById(this.bottleId)) print("[SundaySortBottle] ERROR: unknown bottleId '" + this.bottleId + "' on " + so.name)
    if (this.cameraObject) this.camTransform = this.cameraObject.getTransform()
    this.halfHeight = this.colliderSizeCm.y / 2

    // Pinch target: collider + Interactable on this unit-scale, identity-rotation object.
    this.collider = so.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = this.colliderSizeCm
    this.collider.shape = shape
    this.collider.fitVisual = false
    this.interactable = so.createComponent(Interactable.getTypeName()) as Interactable

    // Halo: a flat ring on the surface the bottle stands on.
    if (this.overlayMaterial) {
      this.halo = makeVisual(so, "BottleHalo", buildCircleRing(3.4, 2.8, 40), this.overlayMaterial, this.highlightColor, true)
      this.halo.getTransform().setLocalPosition(new vec3(0, -this.halfHeight + 0.55, 0))
      this.halo.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI / 2, 0, 0))
      this.halo.getSceneObject().enabled = false
    }

    // Done tick, just above the cap.
    this.tick = global.scene.createSceneObject(SCENE_NAMES.bottleTickPrefix + so.name.replace(SCENE_NAMES.bottlePrefix, ""))
    this.tick.setParent(so)
    this.tick.getTransform().setLocalPosition(new vec3(0, this.halfHeight + 0.6, 0))
    const img = this.tick.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = this.tickIcon
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    mat.mainPass.baseColor = TICK_GREEN
    img.clearMaterials()
    img.addMaterial(mat)
    this.tick.getTransform().setLocalScale(new vec3(1.8, 1.8, 1))
    this.tick.enabled = false

    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onHoverEnter.add(() => {
        this.hovered = true
        this.refresh()
      })
      this.interactable.onHoverExit.add(() => {
        this.hovered = false
        this.refresh()
      })
      this.interactable.onTriggerEnd.add(() => this._onPinched.invoke(this.bottleId))
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSelected(on: boolean): void {
    this.selected = on
    this.refresh()
  }

  /** Gentle pulse that says "this one next" (the out-of-view bottle, once in view). */
  setAttract(on: boolean): void {
    if (this.attract === on) return
    this.attract = on
    this.pulseT = 0
    this.refresh()
  }

  setDone(on: boolean): void {
    this.done = on
    this.tick.enabled = on
  }

  /** End of the week: fade the tick and highlight away, stop taking pinches. */
  finish(seconds: number = 0.8): void {
    this.attract = false
    this.selected = false
    this.hovered = false
    this.refresh()
    this.interactable.enabled = false
    if (this.fade) this.fade()
    const t = this.tick.getTransform()
    this.fade = animate({
      duration: seconds,
      easing: "ease-in-out-quad",
      update: (k: number) => {
        const s = 1.8 * Math.max(0.001, 1 - k)
        t.setLocalScale(new vec3(s, s, 1))
      },
      ended: () => {
        this.fade = null
        this.tick.enabled = false
      },
    })
  }

  setDebugCollider(on: boolean): void {
    if (this.collider) this.collider.debugDrawEnabled = on
  }

  get isDone(): boolean {
    return this.done
  }

  get isHovered(): boolean {
    return this.hovered
  }

  /** Top centre of the bottle in world space (the card floats above it). */
  topWorld(): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(new vec3(0, this.halfHeight - 0.5, 0))
  }

  centerWorld(): vec3 {
    return this.getTransform().getWorldPosition()
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private refresh(): void {
    const lit = this.hovered || this.selected || this.attract
    if (this.halo) this.halo.getSceneObject().enabled = lit
    if (this.visual) {
      const s = this.hovered || this.selected ? this.hoverScale : 1
      this.visual.getTransform().setLocalScale(new vec3(s, s, s))
    }
    if (this.halo && !this.attract) setVisualColor(this.halo, this.highlightColor)
  }

  private onUpdate(): void {
    if (this.attract && this.halo && !this.hovered && !this.selected) {
      this.pulseT += getDeltaTime()
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.pulseT * 3.2))
      setVisualColor(this.halo, new vec4(this.highlightColor.x, this.highlightColor.y, this.highlightColor.z, a))
    }
    if (this.tick.enabled && this.camTransform) {
      const t = this.tick.getTransform()
      const dir = this.camTransform.getWorldPosition().sub(t.getWorldPosition())
      if (dir.length > 0.001) t.setWorldRotation(quat.lookAt(dir.normalize(), vec3.up()))
    }
  }
}
