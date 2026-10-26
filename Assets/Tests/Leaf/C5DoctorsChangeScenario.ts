/**
 * Done criterion 5 (stretch) — pinching the "Doctor's change" card makes only
 * the Thursday to Sunday morning cells pulse orange with "-1 amlodipine";
 * Done applies the change, Undo cancels it.
 *
 * Setup (API-driven shortcut, labelled in the log): selectBottle(id) + done()
 * for all five bottles, then done() for "All checked" — a finished week.
 * Then real SIK pinches (LEAF simulated right hand) on DoctorChangeCard (a UIKit
 * Prism Button holding the Interactable) and on Done / Undo.
 *
 * c5-doctors-change      : card -> dose change -> Done applies it.
 *   parameter stop_in_dose_change = "true" ends the run while the change is
 *   showing (all dose-change checks still run), so the preview can be
 *   screenshotted in that state after the run returns.
 * c5b-doctors-change-undo (own file): card -> dose change -> Undo cancels it.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {openDoseChange, readDim, setupFinishedWeek} from "./C5DoseChangeSteps"
import {BOTTLE_OBJECTS, CameraGuard, CheckList, FrameRecorder, colorOf, log, meshVisual, obj, pinch, shown, visibleCellKeys, waitForLens} from "./SundaySortLeafHelpers"

export const C5_ID = "c5-doctors-change"

@component
export class C5DoctorsChangeScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new CheckList(C5_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C5_ID, main.cameraObject)
    const stop = config ? config.get("stop_in_dose_change") === "true" : false
    try {
      await this.steps(c, main, stop)
    } finally {
      await guard.restore()
    }
    c.finish()
  }

  private async steps(c: CheckList, main: SundaySortMain, stop: boolean): Promise<void> {
    const dim = await readDim()
    await setupFinishedWeek(c, main, C5_ID)
    await openDoseChange(c, main, dim)
    if (stop) {
      log(`${C5_ID} stop_in_dose_change=true: ending the run in the dose-change state (no Done)`)
      return
    }

    const chimesBefore = main.doneChimeCount
    const rec = new FrameRecorder(() => ({
      lit: visibleCellKeys().length,
      alpha: colorOf(meshVisual("CellRing_THU_AM")).w,
      scale: obj("CellRing_THU_AM").getTransform().getLocalScale().x,
      chimes: main.doneChimeCount,
    }))
    await pinch("DoneButton")
    await sleep(1200)
    rec.stop()

    const f = rec.frames
    const iDone = f.findIndex((x) => x.s.chimes > chimesBefore)
    c.check(iDone >= 0, "Done applied the change (done chime played)", iDone >= 0 ? `frame ${iDone}` : "never", "a frame where the chime counter rises")
    if (iDone >= 0) {
      const after = f.slice(iDone)
      const iHidden = after.findIndex((x) => x.s.lit === 0)
      const fading = after.slice(0, iHidden < 0 ? after.length : iHidden)
      let monotonic = true
      for (let i = 1; i < fading.length; i++) if (fading[i].s.alpha > fading[i - 1].s.alpha + 0.02) monotonic = false
      const scaleReset = fading.every((x) => Math.abs(x.s.scale - 1) < 0.001)
      const hideDelay = iHidden >= 0 ? after[iHidden].t - f[iDone].t : -1
      c.check(
        monotonic && scaleReset && fading.length > 0,
        "pulse stops and the orange fades out",
        `${fading.length} fade frame(s), alpha ${fading.map((x) => x.s.alpha.toFixed(2)).slice(0, 8).join(",")}, scale reset=${scaleReset}`,
        "alpha non-increasing, ring scale 1",
      )
      c.check(iHidden >= 0 && hideDelay > 0.25 && hideDelay < 0.9, "cells hidden after the fade", iHidden >= 0 ? `${hideDelay.toFixed(2)} s after Done` : "never", "0.25–0.9 s")
    }
    c.check(visibleCellKeys().length === 0, "no cell shown after Done", JSON.stringify(visibleCellKeys()), "[]")
    c.check(!shown("DoseChangeLabel"), "DoseChangeLabel hidden", String(shown("DoseChangeLabel")), "false")
    c.check(shown("BoxCornerTick"), "corner tick back", String(shown("BoxCornerTick")), "true")
    c.check(!shown("DoctorChangeCard"), "doctor card hidden after applying", String(shown("DoctorChangeCard")), "false")
    c.check(main.mode === "finished", "mode back to finished", main.mode, "finished")
    c.check(main.doseChangeApplied === true, "doseChangeApplied", String(main.doseChangeApplied), "true")
    c.check(main.doneChimeCount - chimesBefore === 1, "one done chime for the change", String(main.doneChimeCount - chimesBefore), "1")
    c.check(!shown("DoneButton") && !shown("UndoButton"), "Done/Undo faded away again", `done=${shown("DoneButton")} undo=${shown("UndoButton")}`, "both false")
    await sleep(2500)
    c.check(!shown("DoctorChangeCard"), "doctor card stays hidden once applied", String(shown("DoctorChangeCard")), "false")
    for (const b of BOTTLE_OBJECTS) c.check(!shown("BottleHalo", obj(b)), `${b} not highlighted at the end`, String(shown("BottleHalo", obj(b))), "false")
  }
}

