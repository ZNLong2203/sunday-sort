/**
 * Done criterion 5 (stretch), cancel path — after a finished week (API-driven
 * setup, labelled), a real pinch on DoctorChangeCard shows the change; a real
 * pinch on Undo cancels it: cells and label fade, corner tick returns, the card
 * stays, mode "finished", doseChangeApplied false, no chime. The card then
 * re-opens the change.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {DOSE_KEYS, openDoseChange, readDim, setupFinishedWeek} from "./C5DoseChangeSteps"
import {CameraGuard, LeafHeadTurner, pitchDownToBox, CheckList, pinch, shown, visibleCellKeys, waitForLens} from "./SundaySortLeafHelpers"

export const C5B_ID = "c5b-doctors-change-undo"

@component
export class C5bDoctorsChangeUndoScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C5B_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C5B_ID, main.cameraObject)
    let head: LeafHeadTurner | null = null
    try {
      head = await pitchDownToBox(c, main, guard)
      await this.steps(c, main)
    } finally {
      if (head) head.dispose()
      await guard.restore()
    }
    c.finish()
  }

  private async steps(c: CheckList, main: SundaySortMain): Promise<void> {
    const dim = await readDim()
    await setupFinishedWeek(c, main, C5B_ID, false) // bottle-card layout is asserted once, in c5-doctors-change
    await openDoseChange(c, main, dim)

    const chimesBefore = main.doneChimeCount
    await pinch("UndoButton")
    await sleep(1000) // 0.2 s fade, 0.8 s controls fade
    c.check(visibleCellKeys().length === 0, "cells hidden after Undo", JSON.stringify(visibleCellKeys()), "[]")
    c.check(!shown("DoseChangeLabel"), "DoseChangeLabel hidden after Undo", String(shown("DoseChangeLabel")), "false")
    c.check(shown("BoxCornerTick"), "corner tick back after Undo", String(shown("BoxCornerTick")), "true")
    c.check(shown("DoctorChangeCard"), "doctor card stays visible after Undo", String(shown("DoctorChangeCard")), "true")
    c.check(main.mode === "finished", "mode back to finished", main.mode, "finished")
    c.check(main.doseChangeApplied === false, "change not applied", String(main.doseChangeApplied), "false")
    c.check(main.doneChimeCount === chimesBefore, "no done chime on Undo", String(main.doneChimeCount - chimesBefore), "0")
    c.check(!shown("DoneButton") && !shown("UndoButton"), "Done/Undo faded away again", `done=${shown("DoneButton")} undo=${shown("UndoButton")}`, "both false")

    // The card can be opened again after a cancel.
    await pinch("DoctorChangeCard")
    await sleep(300)
    c.check(
      main.mode === "doseChange" && JSON.stringify(visibleCellKeys()) === JSON.stringify(DOSE_KEYS),
      "card re-opens the change after Undo",
      `${main.mode} ${JSON.stringify(visibleCellKeys())}`,
      `doseChange ${JSON.stringify(DOSE_KEYS)}`,
    )
  }
}
