/**
 * Done criterion 1 — pinching the metformin bottle lights exactly its 14 cells
 * with "1", leaves every other cell dark (none here: metformin uses all 14),
 * highlights no other bottle, and shows its card "Found: Metformin 500 mg".
 *
 * Interaction: a real SIK pinch on Bottle_Metformin (LEAF simulated right hand).
 * Card position: the brief's "Where things live" puts the card just above the
 * pinched bottle (the criterion text says "above the box"). The scenario checks
 * it floats above the bottle and logs where it is relative to bottle and box.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  ALL_KEYS,
  BOTTLE_OBJECTS,
  CheckList,
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

@component
export class C1MetforminScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C1_ID)
    const main = await waitForLens()

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
    const boxPos = obj("Pillbox").getTransform().getWorldPosition()
    const rimY = boxPos.y + main.pillbox.rimY
    const horiz = Math.sqrt(Math.pow(cardPos.x - bottlePos.x, 2) + Math.pow(cardPos.z - bottlePos.z, 2))
    const aboveBottleTop = cardPos.y - (bottlePos.y + 4.5)
    c.note(
      `card at ${fmt3(cardPos)}; metformin bottle centre ${fmt3(bottlePos)} (top ≈ y ${(bottlePos.y + 4.5).toFixed(1)}); ` +
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

    c.finish()
  }
}
