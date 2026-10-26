/**
 * SundaySortPillbox — the virtual weekly pillbox stand-in (7 days x 2 rows).
 *
 * Owns: the tray geometry (built with MeshBuilder so the cells line up exactly
 *       with the overlay), and the one source of truth for cell positions:
 *       cellCenterLocal(day, row) / rimY / pitch. MON..SUN run left to right,
 *       the morning row is at the back (-Z), the evening row at the front (+Z).
 * Expects: trayMaterial (a lit PBR material). The SceneObject's origin is the
 *          bottom centre of the tray, resting on the counter.
 * Must NOT: draw any overlay (rings, counts, labels) — that is BoxOverlayUI's job.
 *
 * Stand-in: on real glasses the camera would find the real box on the counter;
 * here the box is already placed ~60 cm in front of the start pose.
 */
import {buildBoxes, BoxSpec} from "./SundaySortShapes"

const COLUMNS = 7 // correctness invariant: one column per weekday
const ROWS = 2 // correctness invariant: morning + evening
const WALL_THICKNESS = 0.25
const BASE_THICKNESS = 0.4

@component
export class SundaySortPillbox extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SundaySortPillbox – the 14-cell weekly box stand-in</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Lit material for the tray (PBR). Its colour is overridden by Tray Color.")
  trayMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Overall box width in cm (brief: about 22 cm). Cells split it into 7 columns.")
  @widget(new SliderWidget(14, 32, 0.5))
  widthCm: number = 22

  @input
  @hint("Overall box depth in cm (brief: about 8 cm). Split into a morning and an evening row.")
  @widget(new SliderWidget(6, 14, 0.5))
  depthCm: number = 8

  @input
  @hint("Height of the cell walls in cm.")
  @widget(new SliderWidget(1, 4, 0.1))
  wallHeightCm: number = 2.2

  @input("vec4", "{0.80,0.78,0.96,1}")
  @hint("Tray plastic colour. Keep it light: the Specs display is additive, dark reads as see-through.")
  @widget(new ColorWidget())
  trayColor: vec4
  @ui.group_end

  private built = false

  onAwake(): void {
    this.build()
  }

  get columns(): number {
    return COLUMNS
  }

  get rows(): number {
    return ROWS
  }

  get pitchX(): number {
    return this.widthCm / COLUMNS
  }

  get pitchZ(): number {
    return this.depthCm / ROWS
  }

  /** Local Y of the top of the cell walls (the rim). */
  get rimY(): number {
    return this.wallHeightCm
  }

  /** Cell centre at rim height, in this SceneObject's local space. row 0 = AM (back). */
  cellCenterLocal(day: number, row: number): vec3 {
    const x = -this.widthCm / 2 + this.pitchX * (day + 0.5)
    const z = -this.depthCm / 2 + this.pitchZ * (row + 0.5)
    return new vec3(x, this.rimY, z)
  }

  cellCenterWorld(day: number, row: number): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(this.cellCenterLocal(day, row))
  }

  /** World-space centre of the box top — used for "is the box in view". */
  topCenterWorld(): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(new vec3(0, this.rimY, 0))
  }

  private build(): void {
    if (this.built) return
    this.built = true
    if (!this.trayMaterial) {
      print("[SundaySortPillbox] ERROR: trayMaterial not assigned — tray not drawn")
      return
    }
    const w = this.widthCm, d = this.depthCm, h = this.wallHeightCm
    const t = WALL_THICKNESS
    const boxes: BoxSpec[] = []
    // base plate
    boxes.push({cx: 0, cy: BASE_THICKNESS / 2, cz: 0, hx: w / 2, hy: BASE_THICKNESS / 2, hz: d / 2})
    // outer walls
    boxes.push({cx: 0, cy: h / 2, cz: -d / 2 + t / 2, hx: w / 2, hy: h / 2, hz: t / 2})
    boxes.push({cx: 0, cy: h / 2, cz: d / 2 - t / 2, hx: w / 2, hy: h / 2, hz: t / 2})
    boxes.push({cx: -w / 2 + t / 2, cy: h / 2, cz: 0, hx: t / 2, hy: h / 2, hz: d / 2})
    boxes.push({cx: w / 2 - t / 2, cy: h / 2, cz: 0, hx: t / 2, hy: h / 2, hz: d / 2})
    // divider between the morning and evening rows
    boxes.push({cx: 0, cy: h / 2, cz: 0, hx: w / 2, hy: h / 2, hz: t / 2})
    // dividers between days
    for (let c = 1; c < COLUMNS; c++) {
      const x = -w / 2 + this.pitchX * c
      boxes.push({cx: x, cy: h / 2, cz: 0, hx: t / 2, hy: h / 2, hz: d / 2})
    }

    const so = global.scene.createSceneObject("PillboxTray")
    so.setParent(this.getSceneObject())
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = buildBoxes(boxes)
    const mat = this.trayMaterial.clone()
    mat.mainPass.baseColor = this.trayColor
    rmv.mainMaterial = mat
  }
}
