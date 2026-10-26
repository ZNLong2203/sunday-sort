/**
 * Done criterion 2 (part A) — after a bottle is selected, pinching Done fades
 * the glow (cells visibly fade, then hide), plays a chime, fills that bottle's
 * progress dot and ticks the bottle; the card hides.
 *
 * Interaction: real SIK pinches (LEAF simulated right hand) on Bottle_Metformin,
 * then on the UIKit DoneButton (the Interactable on DoneButton; LEAF targets it
 * directly, so the button's own child "Collider" does not obstruct it).
 * The fade and the chime are sampled every frame while they happen.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  BOTTLE_OBJECTS,
  CheckList,
  FrameRecorder,
  audioComp,
  filledDots,
  haloShown,
  pinch,
  ringAlpha,
  shown,
  shownTicks,
  text,
  visibleCellKeys,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const C2_DONE_ID = "c2a-done-fades-chimes-dot-tick"

@component
export class C2DoneScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C2_DONE_ID)
    const main = await waitForLens()
    const doneAudio = audioComp("DoneChimeAudio")

    const chimesBefore = main.doneChimeCount
    c.check(filledDots().length === 0, "no dot filled at start", JSON.stringify(filledDots()), "[]")
    c.check(shownTicks().length === 0, "no bottle ticked at start", JSON.stringify(shownTicks()), "[]")

    await pinch("Bottle_Metformin")
    await sleep(300)
    c.check(visibleCellKeys().length === 14, "metformin selected: 14 cells lit", String(visibleCellKeys().length), "14")
    c.check(shown("BottleCard"), "card shown before Done", String(shown("BottleCard")), "true")

    const rec = new FrameRecorder(() => ({
      lit: visibleCellKeys().length,
      alpha: ringAlpha("MON_AM"),
      chimes: main.doneChimeCount,
      playing: doneAudio.isPlaying(),
    }))
    await pinch("DoneButton")
    await sleep(1000) // fade is 0.45 s
    rec.stop()

    // When did Done fire (chime counter moved)?
    const f = rec.frames
    const iDone = f.findIndex((x) => x.s.chimes > chimesBefore)
    c.check(iDone >= 0, "Done fired from the pinch (chime played)", iDone >= 0 ? `frame ${iDone}` : "never", "a frame where the chime counter rises")
    if (iDone >= 0) {
      const t0 = f[iDone].t
      const after = f.slice(iDone)
      const fading = after.filter((x) => x.s.lit === 14 && x.s.alpha > 0.02 && x.s.alpha < 0.98)
      c.check(
        fading.length > 0,
        "glow fades (cells still shown with partial alpha after Done)",
        `${fading.length} fading frame(s), alpha samples ${fading.slice(0, 6).map((x) => x.s.alpha.toFixed(2)).join(",")}`,
        "at least one frame with 0 < ring alpha < 1",
      )
      const iHidden = after.findIndex((x) => x.s.lit === 0)
      const hideDelay = iHidden >= 0 ? after[iHidden].t - t0 : -1
      c.check(
        iHidden >= 0 && hideDelay > 0.25 && hideDelay < 0.9,
        "all cells hidden once the fade ends (~0.45 s)",
        iHidden >= 0 ? `hidden ${hideDelay.toFixed(2)} s after Done` : "never hidden",
        "hidden 0.25–0.9 s after Done",
      )
      const playing = after.filter((x) => x.s.playing).length
      c.check(playing > 0, "Done chime audio is playing after Done", `${playing} frame(s) with isPlaying()`, "> 0 frames")
    }
    c.check(!!doneAudio.audioTrack, "Done chime has an audio track", String(!!doneAudio.audioTrack), "true")
    c.check(main.doneChimeCount - chimesBefore === 1, "exactly one Done chime", String(main.doneChimeCount - chimesBefore), "1")

    // End state the user sees.
    c.check(visibleCellKeys().length === 0, "cells hidden after the fade", JSON.stringify(visibleCellKeys()), "[]")
    c.check(JSON.stringify(filledDots()) === "[0]", "metformin's progress dot (dot 0) filled, no other", JSON.stringify(filledDots()), "[0]")
    c.check(JSON.stringify(shownTicks()) === '["BottleTick_Metformin"]', "metformin bottle ticked, no other", JSON.stringify(shownTicks()), '["BottleTick_Metformin"]')
    c.check(!shown("BottleCard"), "card hidden after Done", String(shown("BottleCard")), "false")
    c.check(text("DoneButtonLabel") === "Done", "button still reads Done (4 bottles left)", JSON.stringify(text("DoneButtonLabel")), '"Done"')
    for (const b of BOTTLE_OBJECTS) c.check(!haloShown(b), `${b} not highlighted`, String(haloShown(b)), "false")
    c.check(JSON.stringify(main.doneBottleIds) === '["metformin"]', "controller done set", JSON.stringify(main.doneBottleIds), '["metformin"]')
    c.check(main.selectedBottleId === "", "nothing selected", JSON.stringify(main.selectedBottleId), '""')

    c.finish()
  }
}
