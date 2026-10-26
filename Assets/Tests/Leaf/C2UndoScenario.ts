/**
 * Done criterion 2 (part B) — pinching Undo instead of Done clears the
 * selection without marking anything done: cells and card hidden, no dot
 * filled, no tick, no chime, nothing in the done set.
 *
 * Interaction: real SIK pinches (LEAF simulated right hand) on Bottle_Metformin,
 * then on the UIKit UndoButton's Interactable.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  BOTTLE_OBJECTS,
  CameraGuard,
  LeafHeadTurner,
  pitchDownToBox,
  CheckList,
  filledDots,
  haloShown,
  pinch,
  shown,
  shownTicks,
  text,
  visibleCellKeys,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const C2_UNDO_ID = "c2b-undo-clears-selection"

@component
export class C2UndoScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C2_UNDO_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C2_UNDO_ID, main.cameraObject)
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
    const chimesBefore = main.doneChimeCount

    await pinch("Bottle_Metformin")
    await sleep(300)
    c.check(visibleCellKeys().length === 14, "metformin selected: 14 cells lit", String(visibleCellKeys().length), "14")
    c.check(shown("BottleCard"), "card shown before Undo", String(shown("BottleCard")), "true")

    await pinch("UndoButton")
    await sleep(600) // Undo fade is 0.2 s

    c.check(visibleCellKeys().length === 0, "cells hidden after Undo", JSON.stringify(visibleCellKeys()), "[]")
    c.check(!shown("BottleCard"), "card hidden after Undo", String(shown("BottleCard")), "false")
    c.check(filledDots().length === 0, "no progress dot filled", JSON.stringify(filledDots()), "[]")
    c.check(shownTicks().length === 0, "no bottle ticked", JSON.stringify(shownTicks()), "[]")
    c.check(main.doneChimeCount === chimesBefore, "no Done chime", String(main.doneChimeCount - chimesBefore), "0")
    c.check(main.doneBottleIds.length === 0, "nothing in the done set", JSON.stringify(main.doneBottleIds), "[]")
    c.check(main.selectedBottleId === "", "selection cleared", JSON.stringify(main.selectedBottleId), '""')
    c.check(main.mode === "sorting", "still sorting", main.mode, "sorting")
    c.check(text("DoneButtonLabel") === "Done", "button reads Done", JSON.stringify(text("DoneButtonLabel")), '"Done"')
    for (const b of BOTTLE_OBJECTS) c.check(!haloShown(b), `${b} not highlighted`, String(haloShown(b)), "false")
  }
}
