/**
 * Done criterion 4 — with only Vitamin D left and out of view: exactly one
 * nudge chime from a spatial source on the user's left, and the edge arrow on
 * the left reading "1 left: Vitamin D". Turning to the shelf hides the arrow.
 * Pinching Vitamin D lights only SUN morning. Done -> check mode shows every
 * cell's expected pill icons and total, and the button reads "All checked".
 * Pinching it shows "Week ready"; ~3 s later everything fades except the corner tick.
 *
 * Setup (API-driven shortcut, labelled in the log): selectBottle(id) + done()
 * for metformin, amlodipine, furosemide, atorvastatin.
 * Head turns: LEAF's IK HeadController rotates the Camera Object (LeafHeadTurner):
 * first down to the box (the working pose), then to the shelf and back down.
 * Pinches: real SIK pinches through LEAF's simulated hands — left hand for the
 * shelf bottle, right hand for the UIKit Done / All checked button.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {checkContentsInsideCells, checkOverlayClearOfBottles} from "./SundaySortLayoutChecks"
import {
  ALL_KEYS,
  BOTTLE_OBJECTS,
  CameraGuard,
  CheckList,
  FrameRecorder,
  LeafHeadTurner,
  pitchDownToBox,
  fmtRect,
  meshVisual,
  rectsOverlap,
  screenRectOf,
  screenRectOfVisual,
  PILL_COLOR,
  audioComp,
  cameraLocal,
  cellCount,
  colorOf,
  filledDots,
  fmt3,
  fmt4,
  haloShown,
  log,
  obj,
  pillShape,
  pinch,
  sameRgb,
  screenPos,
  shown,
  shownTicks,
  text,
  visibleCellKeys,
  visibleIcons,
  waitForLens,
  yawLeftDeg,
} from "./SundaySortLeafHelpers"

export const C4_ID = "c4-vitamin-d-nudge-check-finish"

/** Allowed overhang of a check-mode stack beyond its cell, in cm. */
const STACK_TOL_CM = 0.1

type IconSpec = [string, vec4]
interface CellSpec {
  count: string
  icons: IconSpec[]
}

const P = PILL_COLOR
const AM_MWF: CellSpec = {count: "2½", icons: [["oval", P.white], ["round", P.yellow], ["half", P.lightBlue]]}
const AM_PLAIN: CellSpec = {count: "2", icons: [["oval", P.white], ["round", P.yellow]]}
const AM_SUN: CellSpec = {count: "3", icons: [["oval", P.white], ["round", P.yellow], ["capsule", P.amber]]}
const PM_ALL: CellSpec = {count: "2", icons: [["oval", P.white], ["oval", P.pink]]}

/** Brief: MON AM = metformin + amlodipine + half furosemide = "2½" … every evening = metformin + atorvastatin = "2". */
const EXPECTED_CHECK: {[key: string]: CellSpec} = {
  MON_AM: AM_MWF,
  TUE_AM: AM_PLAIN,
  WED_AM: AM_MWF,
  THU_AM: AM_PLAIN,
  FRI_AM: AM_MWF,
  SAT_AM: AM_PLAIN,
  SUN_AM: AM_SUN,
  MON_PM: PM_ALL,
  TUE_PM: PM_ALL,
  WED_PM: PM_ALL,
  THU_PM: PM_ALL,
  FRI_PM: PM_ALL,
  SAT_PM: PM_ALL,
  SUN_PM: PM_ALL,
}

@component
export class C4VitaminDScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C4_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C4_ID, main.cameraObject)
    let head: LeafHeadTurner | null = null
    try {
      head = await pitchDownToBox(c, main, guard)
      await this.steps(c, main, head)
    } finally {
      if (head) head.dispose()
      await guard.restore()
    }
    c.finish()
  }

  private async steps(c: CheckList, main: SundaySortMain, head: LeafHeadTurner): Promise<void> {
    const vdPos = main.bottleVitaminD.centerWorld()
    const boxTop = main.pillbox.topCenterWorld()
    const nudgeAudio = audioComp("NudgeChimeAudio")
    const weekAudio = audioComp("WeekReadyChimeAudio")
    const arrowRoot = obj("OutOfViewArrow")

    // ── Setup (API-DRIVEN shortcut) ──────────────────────────────────────────
    log(`${C4_ID} SETUP (API-driven): selectBottle()+done() for metformin, amlodipine, furosemide`)
    for (const id of ["metformin", "amlodipine", "furosemide"]) {
      main.selectBottle(id)
      main.done()
    }
    await sleep(400)
    c.check(
      !shown("OutOfViewArrow") && main.nudgeChimeCount === 0,
      "no arrow and no nudge while two bottles are still left",
      `arrow=${shown("OutOfViewArrow")} nudges=${main.nudgeChimeCount}`,
      "arrow=false nudges=0",
    )
    c.check(!main.isInView(vdPos), "Vitamin D starts out of view", `isInView=${main.isInView(vdPos)}`, "false")
    c.note(`Vitamin D at ${fmt3(vdPos)} is ${yawLeftDeg(cameraLocal(main, vdPos)).toFixed(1)}° to the left of the start view`)

    const rec = new FrameRecorder(() => ({
      count: main.nudgeChimeCount,
      playing: nudgeAudio.isPlaying(),
      src: cameraLocal(main, nudgeAudio.getSceneObject().getTransform().getWorldPosition()),
    }))
    log(`${C4_ID} SETUP (API-driven): selectBottle()+done() for atorvastatin — only Vitamin D left`)
    main.selectBottle("atorvastatin")
    main.done()
    await sleep(2500) // the nudge fires on the next frame; wait to prove it does not repeat
    rec.stop()

    // ── Nudge: exactly one chime, spatial, from the left ─────────────────────
    c.check(main.nudgeChimeCount === 1, "exactly one nudge chime", String(main.nudgeChimeCount), "1")
    const iChime = rec.frames.findIndex((f) => f.s.count >= 1)
    if (iChime >= 0) {
      const src = rec.frames[iChime].s.src
      const yaw = yawLeftDeg(src)
      c.check(
        src.x < 0 && yaw > 30,
        "nudge chime source is to the user's left when it plays",
        `camera-local ${fmt3(src)}, ${yaw.toFixed(1)}° left`,
        "camera-local x < 0, > 30° left",
      )
      const playing = rec.frames.slice(iChime).filter((f) => f.s.playing).length
      c.check(playing > 0, "nudge chime audio is playing", `${playing} frame(s) with isPlaying()`, "> 0")
    } else {
      c.check(false, "nudge chime fired", "never", "within 2.5 s of the fourth Done")
    }
    const sa = nudgeAudio.spatialAudio
    c.check(
      !!nudgeAudio.audioTrack && sa.enabled && sa.positionEffect.enabled,
      "nudge chime is spatial (track, spatialAudio, positionEffect on)",
      `track=${!!nudgeAudio.audioTrack} spatial=${sa.enabled} position=${sa.positionEffect.enabled}`,
      "all true",
    )
    const srcWorld = nudgeAudio.getSceneObject().getTransform().getWorldPosition()
    c.check(srcWorld.distance(vdPos) < 2, "nudge source sits at the Vitamin D shelf", `${fmt3(srcWorld)} vs bottle ${fmt3(vdPos)}`, "< 2 cm apart")
    const listener = main.cameraObject.getComponent("Component.AudioListenerComponent")
    c.check(!!listener, "camera has an AudioListener (needed for spatial audio)", String(!!listener), "true")

    // ── Arrow at the left edge ───────────────────────────────────────────────
    c.check(shown("OutOfViewArrow"), "out-of-view arrow shown", String(shown("OutOfViewArrow")), "true")
    c.check(text("OutOfViewArrowText") === "1 left: Vitamin D", "arrow text", JSON.stringify(text("OutOfViewArrowText")), '"1 left: Vitamin D"')
    c.check(main.pointer.side === -1, "arrow on the left side", String(main.pointer.side), "-1")
    const arrowPos = arrowRoot.getTransform().getWorldPosition()
    const arrowLocal = cameraLocal(main, arrowPos)
    const arrowScreen = screenPos(main, arrowPos)
    c.note(`arrow centre camera-local ${fmt3(arrowLocal)}, screen (${arrowScreen.x.toFixed(2)}, ${arrowScreen.y.toFixed(2)}) [0..1, x from left]`)
    c.check(
      arrowLocal.x < 0 && arrowScreen.x >= 0 && arrowScreen.x < 0.35,
      "arrow sits at the left edge of the view",
      `screen x ${arrowScreen.x.toFixed(2)}, local x ${arrowLocal.x.toFixed(1)}`,
      "0 <= screen x < 0.35, local x < 0",
    )
    const leftA = colorOf(this.icon(arrowRoot, "ArrowLeftIcon")).w
    const rightA = colorOf(this.icon(arrowRoot, "ArrowRightIcon")).w
    c.check(leftA > 0.5 && rightA < 0.05, "left-pointing arrow lit, right one dark", `left α ${leftA.toFixed(2)} right α ${rightA.toFixed(2)}`, "left > 0.5, right < 0.05")
    c.check(main.pointerMode === "nudge", "controller pointer mode", main.pointerMode, "nudge")

    // Layout: the arrow's on-screen rect must not cover any cell (or Done/Undo).
    const arrowRect = screenRectOf(main, "OutOfViewArrow")
    c.note(`arrow screen rect ${fmtRect(arrowRect)}`)
    const coveredCells = ALL_KEYS.filter((k) => rectsOverlap(arrowRect, screenRectOfVisual(main, meshVisual("CellRing_" + k))))
    c.check(coveredCells.length === 0, "nudge arrow covers no cell on screen", coveredCells.length ? JSON.stringify(coveredCells) : "no overlaps", "no overlaps")
    const coveredButtons = ["DoneButton", "UndoButton"].filter((n) => rectsOverlap(arrowRect, screenRectOf(main, n)))
    c.check(coveredButtons.length === 0, "nudge arrow covers neither Done nor Undo on screen", coveredButtons.length ? JSON.stringify(coveredButtons) : "no overlaps", "no overlaps")

    // ── Turn to the shelf: arrow hides, bottle gets the gentle highlight ─────
    const err1 = await head.lookAt(vdPos)
    await sleep(300)
    c.check(err1 < 3, "head turned to the shelf (LEAF HeadController)", `${err1.toFixed(1)}° off`, "< 3°")
    c.check(main.isInView(vdPos), "Vitamin D in view after the turn", String(main.isInView(vdPos)), "true")
    c.check(!shown("OutOfViewArrow"), "arrow hidden once the shelf is in view", String(shown("OutOfViewArrow")), "false")
    c.check(haloShown("Bottle_VitaminD"), "Vitamin D gets the gentle highlight", String(haloShown("Bottle_VitaminD")), "true")
    c.check(main.nudgeChimeCount === 1, "still one nudge chime after turning", String(main.nudgeChimeCount), "1")

    // Look away again without picking it: arrow may return, but no second chime.
    const err2 = await head.lookAt(boxTop)
    await sleep(300)
    c.check(err2 < 3, "head turned back to the box", `${err2.toFixed(1)}° off`, "< 3°")
    c.check(shown("OutOfViewArrow"), "arrow back while Vitamin D is out of view again", String(shown("OutOfViewArrow")), "true")
    c.check(main.nudgeChimeCount === 1, "no second nudge chime (never nags)", String(main.nudgeChimeCount), "1")

    // ── Turn to the shelf and pinch Vitamin D ────────────────────────────────
    await head.lookAt(vdPos)
    await sleep(200)
    await pinch("Bottle_VitaminD", "left")
    await sleep(300)
    c.check(JSON.stringify(visibleCellKeys()) === '["SUN_AM"]', "only SUN morning lit", JSON.stringify(visibleCellKeys()), '["SUN_AM"]')
    c.check(cellCount("SUN_AM") === "1", "SUN AM count", JSON.stringify(cellCount("SUN_AM")), '"1"')
    const vdIcons = visibleIcons("SUN_AM")
    c.check(
      vdIcons.length === 1 && pillShape(vdIcons[0]) === "capsule" && sameRgb(colorOf(vdIcons[0]), P.amber),
      "SUN AM shows one amber capsule",
      `${vdIcons.length} ${JSON.stringify(vdIcons.map((r) => pillShape(r)))} ${vdIcons.map((r) => fmt4(colorOf(r))).join(" ")}`,
      `1 ["capsule"] ${fmt4(P.amber)}`,
    )
    c.check(text("BottleCardTitle") === "Found: Vitamin D", "Vitamin D card", JSON.stringify(text("BottleCardTitle")), '"Found: Vitamin D"')
    c.check(main.selectedBottleId === "vitaminD", "Vitamin D selected", JSON.stringify(main.selectedBottleId), '"vitaminD"')
    // Brief ("When things show"): a selected bottle with the box out of view -> arrow points back to the box.
    c.note(
      `while looking at the shelf with Vitamin D selected: pointerMode=${main.pointerMode} arrow=${shown("OutOfViewArrow")} ` +
        `text=${JSON.stringify(text("OutOfViewArrowText"))} side=${main.pointer.side}`,
    )

    // ── Turn back: the box is lit and waiting ────────────────────────────────
    await head.lookAt(boxTop)
    await sleep(300)
    c.check(!shown("OutOfViewArrow"), "arrow hidden after turning back to the box", String(shown("OutOfViewArrow")), "false")
    c.check(JSON.stringify(visibleCellKeys()) === '["SUN_AM"]', "SUN AM still lit after turning back", JSON.stringify(visibleCellKeys()), '["SUN_AM"]')

    // ── Done -> check mode ───────────────────────────────────────────────────
    await pinch("DoneButton")
    await sleep(1200) // 0.45 s fade + 0.05 s, then the check view
    c.check(main.mode === "checking", "controller in check mode", main.mode, "checking")
    c.check(text("DoneButtonLabel") === "All checked", "button reads All checked", JSON.stringify(text("DoneButtonLabel")), '"All checked"')
    c.check(JSON.stringify(filledDots()) === "[0,1,2,3,4]", "all five progress dots filled", JSON.stringify(filledDots()), "[0,1,2,3,4]")
    c.check(shownTicks().length === 5, "all five bottles ticked", JSON.stringify(shownTicks()), "5 ticks")
    c.check(!shown("BottleCard"), "card hidden in check mode", String(shown("BottleCard")), "false")
    c.check(JSON.stringify(visibleCellKeys()) === JSON.stringify(ALL_KEYS), "every cell shown in check mode", JSON.stringify(visibleCellKeys()), "all 14")
    for (const key of ALL_KEYS) {
      const want = EXPECTED_CHECK[key]
      const count = cellCount(key)
      c.check(count === want.count, `check ${key} total`, JSON.stringify(count), JSON.stringify(want.count))
      const icons = visibleIcons(key)
      const got = icons.map((r) => pillShape(r) + fmt4(colorOf(r)))
      const ok =
        icons.length === want.icons.length &&
        want.icons.every((spec, i) => pillShape(icons[i]) === spec[0] && sameRgb(colorOf(icons[i]), spec[1]))
      c.check(ok, `check ${key} pill icons`, JSON.stringify(got), JSON.stringify(want.icons.map((s) => s[0] + fmt4(s[1]))))
    }

    // Layout (looking down): each check-mode stack (total + icon row) inside its own cell.
    checkContentsInsideCells(c, main, ALL_KEYS, "check-mode stacks", () => STACK_TOL_CM)
    checkOverlayClearOfBottles(c, main, "check-mode view", false)

    // ── All checked -> Week ready -> fade to the corner tick ─────────────────
    const weekBefore = main.weekReadyChimeCount
    const rec2 = new FrameRecorder(() => ({
      count: main.weekReadyChimeCount,
      week: shown("WeekReady"),
      tick: shown("BoxCornerTick"),
      playing: weekAudio.isPlaying(),
    }))
    await pinch("DoneButton")
    c.check(main.mode === "finished", "controller finished", main.mode, "finished")
    c.check(shown("WeekReady"), "Week ready shown", String(shown("WeekReady")), "true")
    c.check(text("WeekReadyText") === "Week ready", "Week ready text", JSON.stringify(text("WeekReadyText")), '"Week ready"')
    c.check(main.weekReadyChimeCount - weekBefore === 1, "one Week ready chime", String(main.weekReadyChimeCount - weekBefore), "1")
    await sleep(4300)
    rec2.stop()

    const f = rec2.frames
    const i0 = f.findIndex((x) => x.s.count > weekBefore)
    if (i0 >= 0) {
      const t0 = f[i0].t
      const after = f.slice(i0)
      const iWeekGone = after.findIndex((x) => !x.s.week)
      const iTick = after.findIndex((x) => x.s.tick)
      const weekFor = iWeekGone >= 0 ? after[iWeekGone].t - t0 : -1
      const tickAt = iTick >= 0 ? after[iTick].t - t0 : -1
      c.note(`Week ready visible for ${weekFor.toFixed(2)} s; corner tick appeared ${tickAt.toFixed(2)} s after All checked`)
      c.check(weekFor >= 2.8 && weekFor <= 4.2, "Week ready stays about 3 s (plus the fade)", `${weekFor.toFixed(2)} s`, "2.8–4.2 s")
      c.check(tickAt >= 2.8 && tickAt <= 4.3, "corner tick appears after the fade", `${tickAt.toFixed(2)} s`, "2.8–4.3 s")
      const playing = after.filter((x) => x.s.playing).length
      c.check(playing > 0, "Week ready chime audio is playing", `${playing} frame(s)`, "> 0")
    } else {
      c.check(false, "All checked fired", "chime counter never rose", "a rise after the pinch")
    }

    // Final picture: only the corner tick remains.
    c.check(shown("BoxCornerTick"), "corner tick visible at the end", String(shown("BoxCornerTick")), "true")
    const leftovers: string[] = []
    if (shown("WeekReady")) leftovers.push("WeekReady")
    if (visibleCellKeys().length > 0) leftovers.push("cells " + JSON.stringify(visibleCellKeys()))
    if (shown("DayLabel_MON")) leftovers.push("day labels")
    if (shown("ProgressDot_0")) leftovers.push("progress dots")
    if (shown("DoneButton")) leftovers.push("DoneButton")
    if (shown("UndoButton")) leftovers.push("UndoButton")
    if (shownTicks().length > 0) leftovers.push("bottle ticks " + JSON.stringify(shownTicks()))
    if (shown("BottleCard")) leftovers.push("BottleCard")
    if (shown("OutOfViewArrow")) leftovers.push("OutOfViewArrow")
    for (const b of BOTTLE_OBJECTS) if (haloShown(b)) leftovers.push(b + " highlight")
    c.check(leftovers.length === 0, "everything else faded away", JSON.stringify(leftovers), "[]")
  }

  private icon(root: SceneObject, name: string): Image {
    const img = obj(name, root).getComponent("Component.Image") as Image
    if (!img) throw new Error(`"${name}" has no Image component`)
    return img
  }
}
