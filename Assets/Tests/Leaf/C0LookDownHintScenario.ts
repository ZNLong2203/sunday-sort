/**
 * Look-down hint (round 3 behaviour; not one of the five done criteria).
 *
 * At the level start pose the box is ~60° below the view, so the edge arrow
 * shows "Look down at your pillbox" at the bottom of the view with its lit
 * arrow pointing down (pointerMode "lookDown"). Pitching the head down to the
 * box hides it within a few frames. Pitching back up with nothing selected does
 * NOT bring it back (the box has been seen once). Sanity: with a bottle selected,
 * looking up shows the existing turn-back arrow instead.
 *
 * Head: LEAF's IK HeadController (LeafHeadTurner) with DeviceTracking paused;
 * pose and tracking restored at the end. Pinch: real SIK pinch (LEAF simulated
 * right hand) on Bottle_Metformin.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  CameraGuard,
  CheckList,
  FrameRecorder,
  LeafHeadTurner,
  cameraPitchDeg,
  colorOf,
  obj,
  pinch,
  pitchDownToBox,
  screenPos,
  shown,
  text,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const C0_ID = "c0-look-down-hint"
const HINT_TEXT = "Look down at your pillbox"

@component
export class C0LookDownHintScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C0_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C0_ID, main.cameraObject)
    let head: LeafHeadTurner | null = null
    try {
      head = await this.steps(c, main, guard)
    } finally {
      if (head) head.dispose()
      await guard.restore()
    }
    c.finish()
  }

  private async steps(c: CheckList, main: SundaySortMain, guard: CameraGuard): Promise<LeafHeadTurner> {
    const box = main.pillbox.topCenterWorld()
    const ahead = main.cameraObject.getTransform().getWorldPosition().add(new vec3(0, 0, -100))

    // 1. Level start pose (DeviceTracking still on).
    c.check(Math.abs(cameraPitchDeg(main)) < 2, "starts at the level pose", `pitch ${cameraPitchDeg(main).toFixed(1)}°`, "|pitch| < 2°")
    c.check(!main.isInView(box), "box is out of view at the level pose", `isInView=${main.isInView(box)}`, "false")
    c.check(main.pointerMode === "lookDown", "pointer mode at start", main.pointerMode, "lookDown")
    c.check(shown("OutOfViewArrow"), "hint visible at start", String(shown("OutOfViewArrow")), "true")
    c.note(`configured lookDownLabel ${JSON.stringify(main.lookDownLabel)}`)
    c.check(text("OutOfViewArrowText") === HINT_TEXT, "hint text", JSON.stringify(text("OutOfViewArrowText")), JSON.stringify(HINT_TEXT))
    const sp = screenPos(main, obj("OutOfViewArrow").getTransform().getWorldPosition())
    c.check(
      sp.y > 0.75 && Math.abs(sp.x - 0.5) < 0.15,
      "hint sits at the bottom of the view, roughly centred",
      `screen (${sp.x.toFixed(2)}, ${sp.y.toFixed(2)})`,
      "y > 0.75, |x - 0.5| < 0.15",
    )
    this.checkArrowPointsDown(c, main)

    // 2. Pitch down to the box: the hint hides within a few frames.
    const rec = new FrameRecorder(() => ({inView: main.isInView(box), arrow: shown("OutOfViewArrow"), mode: main.pointerMode}))
    const head = await pitchDownToBox(c, main, guard)
    await sleep(200)
    rec.stop()
    const iSeen = rec.frames.findIndex((f) => f.s.inView)
    const iHidden = rec.frames.findIndex((f, i) => i >= Math.max(0, iSeen) && !f.s.arrow)
    const framesToHide = iSeen >= 0 && iHidden >= 0 ? iHidden - iSeen : -1
    c.check(!shown("OutOfViewArrow") && main.pointerMode === "none", "hint hidden once looking down", `arrow=${shown("OutOfViewArrow")} mode=${main.pointerMode}`, "arrow=false mode=none")
    c.check(
      framesToHide >= 0 && framesToHide <= 3,
      "hint hides within a few frames of the box coming into view",
      framesToHide >= 0 ? `${framesToHide} frame(s) after the box entered view` : "box never entered view / arrow never hid",
      "<= 3 frames",
    )

    // 3. Pitch back up with nothing selected: the hint must not return.
    const recUp = new FrameRecorder(() => ({arrow: shown("OutOfViewArrow"), mode: main.pointerMode}))
    const errUp = await head.lookAt(ahead)
    await sleep(600)
    recUp.stop()
    const shownFrames = recUp.frames.filter((f) => f.s.arrow).length
    c.check(errUp < 3 && !main.isInView(box), "head back up, box out of view again", `${errUp.toFixed(1)}° off level, isInView=${main.isInView(box)}`, "< 3°, false")
    c.check(shownFrames === 0 && main.pointerMode === "none", "hint does not come back after the box was seen", `${shownFrames} frame(s) with the arrow, mode=${main.pointerMode}`, "0 frames, mode none")

    // 4. Sanity: the turn-back arrow still works (bottle selected, look up).
    await head.lookAt(box)
    await sleep(200)
    await pinch("Bottle_Metformin")
    await sleep(300)
    c.check(main.selectedBottleId === "metformin", "metformin selected while looking down", JSON.stringify(main.selectedBottleId), '"metformin"')
    await head.lookAt(ahead)
    await sleep(400)
    c.check(main.pointerMode === "turnBack", "pointer mode when looking up with a bottle selected", main.pointerMode, "turnBack")
    c.check(shown("OutOfViewArrow"), "turn-back arrow visible", String(shown("OutOfViewArrow")), "true")
    c.check(
      text("OutOfViewArrowText") === main.turnBackLabel,
      "turn-back arrow text",
      JSON.stringify(text("OutOfViewArrowText")),
      JSON.stringify(main.turnBackLabel),
    )
    this.checkArrowPointsDown(c, main, "turn-back arrow points down toward the box")
    return head
  }

  /** Exactly one arrow icon is lit, and its pointing direction (icon -X) is the camera's down. */
  private checkArrowPointsDown(c: CheckList, main: SundaySortMain, what: string = "lit arrow points down"): void {
    const root = obj("OutOfViewArrow")
    const l = obj("ArrowLeftIcon", root)
    const r = obj("ArrowRightIcon", root)
    const la = colorOf(l.getComponent("Component.Image") as Image).w
    const ra = colorOf(r.getComponent("Component.Image") as Image).w
    c.check(Math.max(la, ra) > 0.5 && Math.min(la, ra) < 0.05, "exactly one arrow icon lit", `left α ${la.toFixed(2)}, right α ${ra.toFixed(2)}`, "one > 0.5, other < 0.05")
    const lit = la >= ra ? l : r
    const dir = lit.getTransform().getWorldRotation().multiplyVec3(new vec3(-1, 0, 0)).normalize()
    const down = main.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, -1, 0))
    const cos = dir.dot(down)
    c.check(cos > 0.9, what, `cos(angle to view-down) ${cos.toFixed(2)} (${((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI).toFixed(0)}°)`, "> 0.9")
  }
}
