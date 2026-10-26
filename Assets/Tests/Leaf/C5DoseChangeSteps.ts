/**
 * Shared steps for the criterion 5 (Doctor's change) scenarios — test-only.
 * setupFinishedWeek: API-driven setup to a finished week (labelled in the log),
 *   checking the doctor card stays hidden until the week is finished.
 * openDoseChange: real SIK pinch on DoctorChangeCard, then every check of the
 *   dose-change state (cells, counts, orange rings, pulse, label, day labels).
 */
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  CheckList,
  DAYS,
  FrameRecorder,
  PILL_COLOR,
  cellCount,
  colorOf,
  fmt4,
  fmtRect,
  log,
  meshVisual,
  obj,
  pillShape,
  pinch,
  rectsOverlap,
  sameRgb,
  sameRgba,
  screenRectOfBox,
  screenRectOf,
  screenRectOfVisual,
  shown,
  text,
  textComp,
  visibleCellKeys,
  labelsOverBottles,
  visibleIcons,
} from "./SundaySortLeafHelpers"

export const DOSE_KEYS = ["THU_AM", "FRI_AM", "SAT_AM", "SUN_AM"]
export const DOSE_DAYS = ["THU", "FRI", "SAT", "SUN"]
const ALL_IDS = ["metformin", "amlodipine", "furosemide", "atorvastatin", "vitaminD"]

function isOrange(col: vec4): boolean {
  return col.x > 0.9 && col.y > 0.35 && col.y < 0.75 && col.z < 0.3
}

/** Finished week via the API (labelled), checking the card stays hidden until the week is finished. */
export async function setupFinishedWeek(c: CheckList, main: SundaySortMain, id: string): Promise<void> {
  c.check(!shown("DoctorChangeCard") && !main.isDoctorCardVisible, "doctor card hidden at start", `shown=${shown("DoctorChangeCard")}`, "false")

  log(`${id} SETUP (API-driven): selectBottle()+done() for all five bottles`)
  for (let i = 0; i < ALL_IDS.length; i++) {
    main.selectBottle(ALL_IDS[i])
    main.done()
    if (i === 2) {
      await sleep(200)
      c.check(!shown("DoctorChangeCard"), "doctor card hidden while sorting", String(shown("DoctorChangeCard")), "false")
    }
  }
  await sleep(700)
  c.check(main.mode === "checking", "check mode reached", main.mode, "checking")
  c.check(!shown("DoctorChangeCard"), "doctor card hidden in check mode (week not finished)", String(shown("DoctorChangeCard")), "false")

  log(`${id} SETUP (API-driven): done() as "All checked" — week finished`)
  const rec = new FrameRecorder(() => ({card: shown("DoctorChangeCard"), week: shown("WeekReady")}))
  const t0 = getTime()
  main.done()
  while (!shown("DoctorChangeCard") && getTime() - t0 < 9) await nextFrame()
  await sleep(200)
  rec.stop()
  const first = rec.frames.find((f) => f.s.card)
  const cardAt = first ? first.t - t0 : -1
  const overlapWeek = rec.frames.filter((f) => f.s.card && f.s.week).length
  c.note(`doctor card appeared ${cardAt.toFixed(2)} s after All checked`)
  c.check(overlapWeek === 0, "doctor card never shows while Week ready is up", `${overlapWeek} frame(s) with both`, "0")
  c.check(cardAt >= 4.3 && cardAt <= 6.8, "doctor card appears after the week fades (3 s + 0.8 s + 1.0 s)", `${cardAt.toFixed(2)} s`, "4.3–6.8 s")
  c.check(shown("DoctorChangeCard") && main.isDoctorCardVisible, "doctor card visible once the week is finished", String(shown("DoctorChangeCard")), "true")
  c.check(text("DoctorChangeCardTitle") === "Doctor's change", "card title", JSON.stringify(text("DoctorChangeCardTitle")), '"Doctor\'s change"')
  c.check(main.mode === "finished", "mode finished before the change", main.mode, "finished")
  c.check(shown("BoxCornerTick"), "corner tick shown before the change", String(shown("BoxCornerTick")), "true")
}

/** Real pinch on the card, then everything the dose-change state must show. */
export async function openDoseChange(c: CheckList, main: SundaySortMain, dim: vec4): Promise<void> {
  await pinch("DoctorChangeCard")
  await sleep(300)
  const orange = main.overlay.doseChangeColor
  c.note(`configured doseChangeColor ${fmt4(orange)}`)
  c.check(isOrange(orange), "configured change colour is orange", fmt4(orange), "r>0.9, 0.35<g<0.75, b<0.3")
  c.check(main.mode === "doseChange", "mode doseChange after the pinch", main.mode, "doseChange")

  const lit = visibleCellKeys()
  c.check(JSON.stringify(lit) === JSON.stringify(DOSE_KEYS), "exactly THU–SUN morning cells shown, no other cell", JSON.stringify(lit), JSON.stringify(DOSE_KEYS))
  for (const key of DOSE_KEYS) {
    const count = cellCount(key)
    const countCol = textComp("CellCount_" + key).textFill.color
    c.check(count === "-1", `${key} count`, JSON.stringify(count), '"-1"')
    c.check(sameRgb(countCol, orange), `${key} count is orange`, fmt4(countCol), fmt4(orange))
    const ringCol = colorOf(meshVisual("CellRing_" + key))
    c.check(
      sameRgb(ringCol, orange) && sameRgb(main.overlay.cellRingColor(key), orange),
      `${key} ring is orange`,
      `material ${fmt4(ringCol)} overlay ${fmt4(main.overlay.cellRingColor(key))}`,
      fmt4(orange),
    )
    const icons = visibleIcons(key)
    c.check(
      icons.length === 1 && pillShape(icons[0]) === "round" && sameRgb(colorOf(icons[0]), PILL_COLOR.yellow),
      `${key} shows the yellow round amlodipine icon`,
      `${icons.length} ${JSON.stringify(icons.map((r) => pillShape(r)))} ${icons.map((r) => fmt4(colorOf(r))).join(" ")}`,
      `1 ["round"] ${fmt4(PILL_COLOR.yellow)}`,
    )
  }

  // Pulse: sample ring alpha and scale over ~1.6 s (a 4.2 rad/s sine ≈ one full cycle).
  const rec = new FrameRecorder(() => ({
    aThu: colorOf(meshVisual("CellRing_THU_AM")).w,
    sThu: obj("CellRing_THU_AM").getTransform().getLocalScale().x,
    aSun: colorOf(meshVisual("CellRing_SUN_AM")).w,
  }))
  await sleep(1600)
  rec.stop()
  const range = (xs: number[]) => ({min: Math.min(...xs), max: Math.max(...xs)})
  const aT = range(rec.frames.map((f) => f.s.aThu))
  const sT = range(rec.frames.map((f) => f.s.sThu))
  const aS = range(rec.frames.map((f) => f.s.aSun))
  c.check(aT.max - aT.min > 0.3, "THU AM ring alpha pulses", `alpha ${aT.min.toFixed(2)}–${aT.max.toFixed(2)} over ${rec.frames.length} frames`, "range > 0.3")
  c.check(sT.max - sT.min > 0.05, "THU AM ring scale pulses", `scale ${sT.min.toFixed(3)}–${sT.max.toFixed(3)}`, "range > 0.05")
  c.check(aS.max - aS.min > 0.3, "SUN AM ring alpha pulses", `alpha ${aS.min.toFixed(2)}–${aS.max.toFixed(2)}`, "range > 0.3")
  c.check(main.overlay.isDoseChangePulsing, "overlay reports pulsing", String(main.overlay.isDoseChangePulsing), "true")

  c.check(shown("DoseChangeLabel"), "DoseChangeLabel visible", String(shown("DoseChangeLabel")), "true")
  c.check(text("DoseChangeLabel") === "-1 amlodipine", "DoseChangeLabel text", JSON.stringify(text("DoseChangeLabel")), '"-1 amlodipine"')

  for (const d of DAYS) {
    const name = "DayLabel_" + d
    const col = textComp(name).textFill.color
    const scale = obj(name).getTransform().getLocalScale().x
    if (DOSE_DAYS.indexOf(d) >= 0) {
      c.check(shown(name) && sameRgb(col, orange) && col.w > 0.95 && scale > 1.05, `${name} lit orange`, `shown=${shown(name)} color ${fmt4(col)} scale ${scale.toFixed(2)}`, `orange ${fmt4(orange)}, scale > 1`)
    } else {
      c.check(sameRgba(col, dim) && Math.abs(scale - 1) < 0.01, `${name} stays dim`, `color ${fmt4(col)} scale ${scale.toFixed(2)}`, `dim ${fmt4(dim)} scale 1.00`)
    }
  }

  c.check(!shown("BoxCornerTick"), "corner tick hidden during the change", String(shown("BoxCornerTick")), "false")
  c.check(shown("DoneButton") && shown("UndoButton"), "Done and Undo back", `done=${shown("DoneButton")} undo=${shown("UndoButton")}`, "both true")
  c.check(text("DoneButtonLabel") === "Done", "Done reads Done", JSON.stringify(text("DoneButtonLabel")), '"Done"')
  c.note(`doctor card visible during the change: ${shown("DoctorChangeCard")}`)

  // Layout note: does the doctor card cover any bottle (pinch-target box) on screen?
  const cardRect = screenRectOf(main, "DoctorChangeCard")
  const bottles = [main.bottleMetformin, main.bottleAmlodipine, main.bottleFurosemide, main.bottleAtorvastatin]
  const covered = bottles
    .filter((b) => rectsOverlap(cardRect, screenRectOfBox(main, b.getTransform(), b.colliderSizeCm)))
    .map((b) => b.getSceneObject().name)
  c.note(`doctor card screen rect ${fmtRect(cardRect)}; bottles it overlaps on screen: ${covered.length ? JSON.stringify(covered) : "none"}`)
  const over = labelsOverBottles(main, DOSE_KEYS.map((k) => "CellCount_" + k).concat(["DoseChangeLabel"]))
  c.note(`dose-change labels whose screen anchor falls on a counter bottle: ${over.length ? JSON.stringify(over) : "none"}`)
}

export async function readDim(): Promise<vec4> {
  return textComp("DayLabel_MON").textFill.color
}
