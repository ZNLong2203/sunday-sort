/**
 * Done criterion 3 — pinching the furosemide bottle lights only the MON, WED
 * and FRI morning cells, each with count text exactly "½" (never "0.5") and a
 * light-blue half-pill icon; those three day labels brighten, the other four don't.
 *
 * Interaction: a real SIK pinch on Bottle_Furosemide (LEAF simulated right hand).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  BOTTLE_OBJECTS,
  CheckList,
  DAYS,
  PILL_COLOR,
  cellCount,
  colorOf,
  fmt4,
  haloShown,
  obj,
  pillShape,
  pinch,
  sameRgb,
  sameRgba,
  shown,
  text,
  textComp,
  visibleCellKeys,
  visibleIcons,
  waitForLens,
} from "./SundaySortLeafHelpers"

export const C3_ID = "c3-furosemide-half-mon-wed-fri"

const EXPECTED_CELLS = ["MON_AM", "WED_AM", "FRI_AM"]
const LIT_DAYS = ["MON", "WED", "FRI"]

@component
export class C3FurosemideScenario extends Scenario {
  async run(): Promise<void> {
    const c = new CheckList(C3_ID)
    const main = await waitForLens()

    // Unlit baseline for the day labels, read before anything is selected.
    const baseColor = textComp("DayLabel_TUE").textFill.color
    const baseScale = obj("DayLabel_TUE").getTransform().getLocalScale().x

    await pinch("Bottle_Furosemide")
    await sleep(300)

    const lit = visibleCellKeys()
    c.check(
      JSON.stringify(lit) === JSON.stringify(EXPECTED_CELLS),
      "only MON, WED, FRI morning cells lit",
      JSON.stringify(lit),
      JSON.stringify(EXPECTED_CELLS),
    )

    for (const key of EXPECTED_CELLS) {
      const count = cellCount(key)
      c.check(count === "½", `Cell ${key} count is exactly "½"`, JSON.stringify(count), '"½"')
      c.check(count.indexOf("0.5") < 0 && count.indexOf(".") < 0, `Cell ${key} count never "0.5"`, JSON.stringify(count), "no decimal")
      const icons = visibleIcons(key)
      const shapes = icons.map((r) => pillShape(r))
      c.check(
        icons.length === 1 && shapes[0] === "half" && sameRgb(colorOf(icons[0]), PILL_COLOR.lightBlue),
        `Cell ${key} shows one light-blue half-pill icon`,
        `${icons.length} icon(s) ${JSON.stringify(shapes)} ${icons.map((r) => fmt4(colorOf(r))).join(" ")}`,
        `1 icon ["half"] ${fmt4(PILL_COLOR.lightBlue)}`,
      )
    }

    // Day labels: MON/WED/FRI brighten (lit colour, alpha up, grow); the other four stay as the baseline.
    const litColor = main.overlay.dayLitColor
    for (const d of DAYS) {
      const name = "DayLabel_" + d
      const col = textComp(name).textFill.color
      const scale = obj(name).getTransform().getLocalScale().x
      if (LIT_DAYS.indexOf(d) >= 0) {
        c.check(
          sameRgba(col, litColor) && col.w > baseColor.w && scale > baseScale + 0.05,
          `${name} brightens`,
          `color ${fmt4(col)} scale ${scale.toFixed(2)}`,
          `color ${fmt4(litColor)} (alpha > baseline ${baseColor.w.toFixed(2)}), scale > ${baseScale.toFixed(2)}`,
        )
      } else {
        c.check(
          sameRgba(col, baseColor) && Math.abs(scale - baseScale) < 0.01,
          `${name} stays dim`,
          `color ${fmt4(col)} scale ${scale.toFixed(2)}`,
          `baseline color ${fmt4(baseColor)} scale ${baseScale.toFixed(2)}`,
        )
      }
    }
    c.check(
      JSON.stringify(main.overlay.litDayFlags) === JSON.stringify([true, false, true, false, true, false, false]),
      "overlay lit-day flags",
      JSON.stringify(main.overlay.litDayFlags),
      "[true,false,true,false,true,false,false]",
    )

    // Card (from "Where things live").
    c.check(shown("BottleCard"), "card visible", String(shown("BottleCard")), "true")
    c.check(text("BottleCardTitle") === "Found: Furosemide 20 mg", "card title", JSON.stringify(text("BottleCardTitle")), '"Found: Furosemide 20 mg"')
    c.check(
      text("BottleCardNote") === "½ tablet — split before you start",
      "card note",
      JSON.stringify(text("BottleCardNote")),
      '"½ tablet — split before you start"',
    )

    for (const b of BOTTLE_OBJECTS) {
      const want = b === "Bottle_Furosemide"
      c.check(haloShown(b) === want, `${b} highlight ${want ? "on" : "off"}`, String(haloShown(b)), String(want))
    }

    c.finish()
  }
}
