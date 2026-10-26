/**
 * Supplementary (not a done criterion) — IK reachability + a full week with no
 * API shortcuts. LEAF's IK interactor (createIKInteractor: Bitmoji avatar, IK
 * arms, IK head) pinches every target the way a standing user would:
 * the four counter bottles and Done (right hand), Undo once, then Vitamin D on
 * the left shelf with the LEFT hand — the IK head turns toward the shelf by
 * itself (59° > LEAF's 15° re-aim threshold) — then Done and All checked.
 *
 * A trigger that fails LEAF's reach checks (out of reach, cross-body, behind,
 * out of view, convergence timeout) records a diagnostic; LEAF then routes the
 * pinch through its simulated-SIK fallback and fails the scenario at the end
 * with "Failed interactions detected". That is a real reachability finding.
 * A ray that never converges throws inside LEAF; this scenario catches it,
 * logs which interactables the IK hand hovered during the attempt (to tell
 * occlusion by a neighbour from a plain miss), fails that reach check, and
 * completes the pinch through LEAF's simulated-SIK DefaultLeafInteractor so
 * the rest of the targets still get an IK reach attempt.
 *
 * DeviceTracking is paused for the run (see CameraGuard's note) so the IK
 * head pose is the pose the Lens's own per-frame logic sees; the camera pose
 * and tracking are restored at the end.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {IKBodyInteractor} from "Leaf.lspkg/Interactors/interactor/ik/IKBodyInteractor"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  BOTTLE_OBJECTS,
  CameraGuard,
  pitchDownToBox,
  CheckList,
  FrameRecorder,
  filledDots,
  fmt3,
  fmtRect,
  log,
  rectsOverlap,
  screenRectOfBox,
  shown,
  text,
  visibleCellKeys,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const IK_ID = "ik-reach-full-week"

@component
export class IKReachScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(IK_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(IK_ID, main.cameraObject)
    try {
      // Working pose: pitch down to the box, then stop the turner so only LEAF's IK head moves the camera.
      const head = await pitchDownToBox(c, main, guard)
      head.dispose()
      // From the looking-down pose: no bottle's pinch target overlaps another's on screen.
      this.checkBottlesSeparateOnScreen(c, main)
      await this.steps(c, main)
    } finally {
      await guard.restore()
    }
    c.finish()
  }

  private checkBottlesSeparateOnScreen(c: CheckList, main: SundaySortMain): void {
    const bottles = [main.bottleMetformin, main.bottleAmlodipine, main.bottleFurosemide, main.bottleAtorvastatin, main.bottleVitaminD]
    const rects = bottles.map((b) => ({name: b.getSceneObject().name, r: screenRectOfBox(main, b.getTransform(), b.colliderSizeCm)}))
    const overlaps: string[] = []
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) if (rectsOverlap(rects[i].r, rects[j].r)) overlaps.push(`${rects[i].name}×${rects[j].name}`)
    for (const x of rects.slice(0, 4)) c.note(`${x.name} pinch target ${fmt3(main.bottleMetformin.colliderSizeCm)} cm, screen rect ${fmtRect(x.r)}`)
    c.check(overlaps.length === 0, "no bottle pinch target overlaps another on screen (looking down)", overlaps.length ? JSON.stringify(overlaps) : "no overlaps", "no overlaps")
  }

  private async steps(c: CheckList, main: SundaySortMain): Promise<void> {
    const ik = createIKInteractor()
    try {
      await this.week(c, main, ik)
    } finally {
      // Stop the IK head writing the camera before CameraGuard restores the pose.
      ik.destroy()
    }
  }

  private async week(c: CheckList, main: SundaySortMain, ik: IKBodyInteractor): Promise<void> {
    await Promise.race([ik.ready, sleep(20000)])
    const diags = DiagnosticRecorder.getInstance()

    const fallback = new DefaultLeafInteractor("IKReachFallback")
    const watch = BOTTLE_OBJECTS.concat(["DoneButton", "UndoButton"])

    /** IK pinch; on a reach failure, record it, then finish the pinch via LEAF's simulated SIK interactor so the flow continues. */
    const reach = async (name: string, hand: "left" | "right" = "right"): Promise<void> => {
      const target = findInteractableByName(name, undefined, true) as Interactable
      if (!target) throw new Error(`Interactable "${name}" not found or not enabled`)
      const route = ik[hand].isIndirect(target) ? "far-field ray" : "direct poke"
      const before = diags.getAll().length
      const hovered: string[] = []
      const unsubs = watch.map((n) => {
        const it = findInteractableByName(n)
        return it ? it.onHoverEnter.add(() => hovered.push(n)) : null
      })
      const t0 = getTime()
      let thrown = ""
      try {
        await ik.trigger(target, hand)
      } catch (e) {
        thrown = String(e)
      } finally {
        for (const u of unsubs) if (u) u()
      }
      const added = diags.getAll().slice(before)
      const what = added.length === 0 ? "no diagnostics" : added.map((e) => `${e.diagnostic.severity}:${e.diagnostic.category}`).join(", ")
      const hov = hovered.length === 0 ? "none" : Array.from(new Set(hovered)).join(",")
      log(`${IK_ID} IK ${hand} hand -> ${name}: ${route}, ${(getTime() - t0).toFixed(1)} s, ${what}${thrown ? ", THREW " + thrown : ""}, hovered during attempt: ${hov}`)
      c.check(thrown === "" && added.length === 0, `IK ${hand}-hand reach to ${name} (${route})`, thrown || what, "converges, no diagnostics")
      if (thrown) {
        log(`${IK_ID} completing ${name} via LEAF simulated-SIK fallback (not IK) so the flow can continue`)
        await fallback.trigger(target)
      }
      await sleep(400)
    }

    // Counter bottles + Done, right hand.
    await reach("Bottle_Metformin")
    c.check(main.selectedBottleId === "metformin" && visibleCellKeys().length === 14, "IK pinch selects metformin", `${main.selectedBottleId} / ${visibleCellKeys().length} cells`, "metformin / 14")
    await reach("DoneButton")
    c.check(JSON.stringify(filledDots()) === "[0]", "IK pinch on Done marks metformin", JSON.stringify(filledDots()), "[0]")

    await reach("Bottle_Furosemide")
    c.check(main.selectedBottleId === "furosemide", "IK pinch selects furosemide", main.selectedBottleId, "furosemide")
    await reach("UndoButton")
    await sleep(300)
    c.check(main.selectedBottleId === "" && visibleCellKeys().length === 0, "IK pinch on Undo clears it", `"${main.selectedBottleId}" / ${visibleCellKeys().length} cells`, `"" / 0`)

    for (const [obj, id] of [
      ["Bottle_Amlodipine", "amlodipine"],
      ["Bottle_Furosemide", "furosemide"],
      ["Bottle_Atorvastatin", "atorvastatin"],
    ]) {
      await reach(obj)
      c.check(main.selectedBottleId === id, `IK pinch selects ${id}`, main.selectedBottleId, id)
      await reach("DoneButton")
    }
    c.check(main.doneBottleIds.length === 4, "four bottles done by IK pinches", JSON.stringify(main.doneBottleIds), "4 ids")
    await sleep(500)
    c.check(main.nudgeChimeCount === 1 && shown("OutOfViewArrow"), "nudge after the fourth bottle", `chimes=${main.nudgeChimeCount} arrow=${shown("OutOfViewArrow")}`, "chimes=1 arrow=true")

    // Shelf bottle, left hand: the IK head turns toward it before the reach.
    const vdPos = main.bottleVitaminD.centerWorld()
    const rec = new FrameRecorder(() => ({inView: main.isInView(vdPos), arrow: shown("OutOfViewArrow"), sel: main.selectedBottleId}))
    await reach("Bottle_VitaminD", "left")
    rec.stop()
    const turnedBeforePinch = rec.frames.filter((f) => f.s.inView && f.s.sel === "" && !f.s.arrow).length
    c.check(turnedBeforePinch > 0, "IK head turn brings the shelf into view and the arrow hides before the pinch", `${turnedBeforePinch} frame(s)`, "> 0")
    c.check(main.selectedBottleId === "vitaminD" && JSON.stringify(visibleCellKeys()) === '["SUN_AM"]', "IK left-hand pinch selects Vitamin D", `${main.selectedBottleId} ${JSON.stringify(visibleCellKeys())}`, 'vitaminD ["SUN_AM"]')

    // Done (head re-aims at the button) -> check mode -> All checked.
    await reach("DoneButton")
    await sleep(800)
    c.check(text("DoneButtonLabel") === "All checked" && main.mode === "checking", "IK Done enters check mode", `${text("DoneButtonLabel")} / ${main.mode}`, "All checked / checking")
    await reach("DoneButton")
    c.check(shown("WeekReady") && main.mode === "finished", "IK All checked shows Week ready", `${shown("WeekReady")} / ${main.mode}`, "true / finished")

    const report = diags.toReport()
    log(`${IK_ID} IK diagnostics:${report.length > 0 ? report : " none"}`)
  }
}
