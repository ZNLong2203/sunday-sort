/**
 * Done criterion 1 — pinching the metformin bottle lights exactly its 14 cells
 * with "1", leaves every other cell dark (none here: metformin uses all 14),
 * highlights no other bottle, and shows its card "Found: Metformin 500 mg".
 *
 * Interaction: a real SIK pinch on Bottle_Metformin (LEAF simulated right hand).
 * Card position: the brief's "Where things live" puts the card just above the
 * pinched bottle (the criterion text says "above the box"). The scenario checks
 * it floats above the bottle and logs where it is relative to bottle and box.
 * Pose: the head is pitched down to the box first (the user's working pose);
 * layout checks project with the Lens camera from that pose.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SundaySortMain} from "../../Scripts/SundaySortMain"
import {
  bottleFootprints,
  buttonFootprints,
  cellRect,
  checkButtonsClearOfCells,
  checkContentsInsideCells,
  checkOverlayClearOfBottles,
  describeText,
  overlaps,
} from "./SundaySortLayoutChecks"
import {
  ALL_KEYS,
  BOTTLE_OBJECTS,
  CameraGuard,
  CheckList,
  LeafHeadTurner,
  PM_KEYS,
  fmtRect,
  pitchDownToBox,
  screenRectOf,
  PILL_COLOR,
  cellCount,
  colorOf,
  filledDots,
  fmt3,
  fmt4,
  haloShown,
  meshVisual,
  obj,
  pillShape,
  pinch,
  sameRgb,
  shown,
  text,
  visibleCellKeys,
  visibleIcons,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const C1_ID = "c1-metformin-lights-14-cells"

/** Allowed overhang of a lit "1" + icon pair beyond its cell, in cm. */
const LIT_TOL_CM = 0.1

@component
export class C1MetforminScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C1_ID)
    const main = await waitForLens()
    const guard = new CameraGuard(C1_ID, main.cameraObject)
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
    // Layout from the looking-down pose: Done/Undo must not cover any cell on screen.
    checkButtonsClearOfCells(c, main)
    this.checkButtonsBelowFrontRow(c, main)

    // Precondition: nothing floats by default.
    c.check(visibleCellKeys().length === 0, "no cell lit before the pinch", JSON.stringify(visibleCellKeys()), "[]")
    c.check(!shown("BottleCard"), "card hidden before the pinch", String(shown("BottleCard")), "false")

    await pinch("Bottle_Metformin")
    await sleep(300)

    // Exactly its 14 cells.
    const lit = visibleCellKeys()
    c.check(
      JSON.stringify(lit) === JSON.stringify(ALL_KEYS),
      "exactly the 14 metformin cells are lit",
      `${lit.length} lit ${JSON.stringify(lit)}`,
      `14 ${JSON.stringify(ALL_KEYS)}`,
    )

    // Each lit cell: count "1", cyan ring, one white oval icon.
    const ringColor = main.overlay.ringColor
    for (const key of ALL_KEYS) {
      const count = cellCount(key)
      c.check(count === "1", `Cell ${key} count`, JSON.stringify(count), '"1"')
      const ring = meshVisual("CellRing_" + key)
      c.check(
        shown("CellRing_" + key) && sameRgb(colorOf(ring), ringColor) && colorOf(ring).w > 0.95,
        `Cell ${key} ring visible and cyan`,
        `shown=${shown("CellRing_" + key)} color=${fmt4(colorOf(ring))}`,
        `shown=true color≈${fmt4(ringColor)}`,
      )
      const icons = visibleIcons(key)
      const shapes = icons.map((r) => pillShape(r))
      const colorsOk = icons.length === 1 && sameRgb(colorOf(icons[0]), PILL_COLOR.white)
      c.check(
        icons.length === 1 && shapes[0] === "oval" && colorsOk,
        `Cell ${key} icon is one white oval`,
        `${icons.length} icon(s) ${JSON.stringify(shapes)} ${icons.map((r) => fmt4(colorOf(r))).join(" ")}`,
        `1 icon ["oval"] ${fmt4(PILL_COLOR.white)}`,
      )
    }

    // Card: visible with the right text.
    c.check(shown("BottleCard"), "card visible", String(shown("BottleCard")), "true")
    const title = text("BottleCardTitle")
    c.check(title === "Found: Metformin 500 mg", "card title", JSON.stringify(title), '"Found: Metformin 500 mg"')
    const note = text("BottleCardNote")
    c.check(note === "", "card note empty for metformin", JSON.stringify(note), '""')

    // Card position: above the pinched bottle (brief: "floats just above the bottle I pinched").
    const cardPos = obj("BottleCard").getTransform().getWorldPosition()
    const bottlePos = obj("Bottle_Metformin").getTransform().getWorldPosition()
    const bottleTopY = bottlePos.y + main.bottleMetformin.colliderSizeCm.y / 2
    const boxPos = obj("Pillbox").getTransform().getWorldPosition()
    const rimY = boxPos.y + main.pillbox.rimY
    const horiz = Math.sqrt(Math.pow(cardPos.x - bottlePos.x, 2) + Math.pow(cardPos.z - bottlePos.z, 2))
    const aboveBottleTop = cardPos.y - bottleTopY
    c.note(
      `card at ${fmt3(cardPos)}; metformin bottle centre ${fmt3(bottlePos)} (pinch-target top y ${bottleTopY.toFixed(1)}); ` +
        `box origin ${fmt3(boxPos)} rim y ${rimY.toFixed(1)}; card centre is ${aboveBottleTop.toFixed(1)} cm above the bottle top, ` +
        `${horiz.toFixed(1)} cm sideways from the bottle axis, ${(cardPos.y - rimY).toFixed(1)} cm above the box rim, ` +
        `${(cardPos.x - boxPos.x).toFixed(1)} cm right of the box centre`,
    )
    c.check(
      horiz < 3 && aboveBottleTop > 1,
      "card floats just above the metformin bottle",
      `sideways ${horiz.toFixed(1)} cm, above bottle top ${aboveBottleTop.toFixed(1)} cm`,
      "sideways < 3 cm, above bottle top > 1 cm",
    )
    c.check(cardPos.y > rimY, "card is higher than the box rim", `card y ${cardPos.y.toFixed(1)}`, `> rim y ${rimY.toFixed(1)}`)

    // Selection and highlight: only metformin.
    for (const b of BOTTLE_OBJECTS) {
      const want = b === "Bottle_Metformin"
      c.check(haloShown(b) === want, `${b} highlight ${want ? "on" : "off"}`, String(haloShown(b)), String(want))
    }
    c.check(main.selectedBottleId === "metformin", "controller selection", JSON.stringify(main.selectedBottleId), '"metformin"')

    // Nothing marked done by a select.
    c.check(filledDots().length === 0, "no progress dot filled", JSON.stringify(filledDots()), "[]")

    // Layout (looking down): counts + icons inside their own cells, nothing over a bottle.
    c.note(`text bbox sample: ${describeText("CellCount_MON_AM")}; ${describeText("DayLabel_MON")}`)
    checkContentsInsideCells(c, main, ALL_KEYS, "lit metformin cells", () => LIT_TOL_CM)
    checkOverlayClearOfBottles(c, main, "lit metformin view")
    const cardHits = overlaps([{name: "BottleCard", r: screenRectOf(main, "BottleCard")}], bottleFootprints(main))
    c.note(`BottleCard screen rect ${fmtRect(screenRectOf(main, "BottleCard"))}; bottles it overlaps: ${cardHits.length ? JSON.stringify(cardHits) : "none"}`)
  }

  /** From the looking-down pose the buttons lie on the counter in front of the box: their top edge must be below the front (evening) row (screen y grows down). */
  private checkButtonsBelowFrontRow(c: CheckList, main: SundaySortMain): void {
    const cells = ALL_KEYS.map((k) => ({key: k, r: cellRect(main, k)}))
    const buttons = buttonFootprints(main)
    const frontBottom = Math.max(...cells.filter((x) => PM_KEYS.indexOf(x.key) >= 0).map((x) => x.r.maxY))
    const buttonTop = Math.min(...buttons.map((b) => b.r.minY))
    c.note(`front-row cells bottom edge y ${frontBottom.toFixed(3)}; buttons top edge y ${buttonTop.toFixed(3)}`)
    c.check(
      buttonTop >= frontBottom,
      "Done/Undo sit below the front row on screen",
      `button top y ${buttonTop.toFixed(3)} vs front-row bottom y ${frontBottom.toFixed(3)} (gap ${(buttonTop - frontBottom).toFixed(3)} of screen height)`,
      "button top y >= front-row bottom y",
    )
  }
}
