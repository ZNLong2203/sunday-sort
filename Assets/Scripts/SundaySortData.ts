/**
 * SundaySortData — hard-coded SAMPLE schedule for the Sunday Sort design demo.
 *
 * Owns: the five bottles, which cells each one goes into, the per-cell count,
 *       the pill icon shape + colour, count formatting ("½", never "0.5"),
 *       and the stable scene-object names LEAF tests look up.
 * Expects: nothing (pure data, no scene access).
 * Must NOT: hold runtime state or touch the scene.
 *
 * This is demo data from the approved design brief, not real medication data.
 * On a real box the printed prescription list stays the source of truth.
 */

export const DAY_NAMES: string[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

/** Row 0 = morning (back row of the box), row 1 = evening (front row). */
export const ROW_NAMES: string[] = ["AM", "PM"]
export const ROW_AM = 0
export const ROW_PM = 1

export type PillShape = "oval" | "round" | "half" | "capsule"

export interface CellRef {
  day: number // 0 = MON .. 6 = SUN
  row: number // ROW_AM | ROW_PM
}

export interface BottleDef {
  id: string
  /** Text after "Found: " on the bottle card. */
  displayName: string
  /** Short name for the out-of-view nudge ("1 left: Vitamin D"). */
  shortName: string
  /** Second card line, or "" for none. */
  cardNote: string
  cells: CellRef[]
  perCell: number
  shape: PillShape
  color: vec4
  /** True for the bottle that lives on the shelf to the user's left. */
  onShelf: boolean
}

function allDays(row: number): CellRef[] {
  const out: CellRef[] = []
  for (let d = 0; d < 7; d++) out.push({day: d, row: row})
  return out
}

export const BOTTLES: BottleDef[] = [
  {
    id: "metformin",
    displayName: "Metformin 500 mg",
    shortName: "Metformin",
    cardNote: "",
    cells: allDays(ROW_AM).concat(allDays(ROW_PM)),
    perCell: 1,
    shape: "oval",
    color: new vec4(0.97, 0.97, 0.97, 1), // white oval
    onShelf: false,
  },
  {
    id: "amlodipine",
    displayName: "Amlodipine 5 mg",
    shortName: "Amlodipine",
    cardNote: "",
    cells: allDays(ROW_AM),
    perCell: 1,
    shape: "round",
    color: new vec4(1.0, 0.88, 0.2, 1), // yellow round
    onShelf: false,
  },
  {
    id: "furosemide",
    displayName: "Furosemide 20 mg",
    shortName: "Furosemide",
    cardNote: "½ tablet — split before you start",
    cells: [
      {day: 0, row: ROW_AM},
      {day: 2, row: ROW_AM},
      {day: 4, row: ROW_AM},
    ],
    perCell: 0.5,
    shape: "half",
    color: new vec4(0.5, 0.82, 1.0, 1), // light-blue half tablet
    onShelf: false,
  },
  {
    id: "atorvastatin",
    displayName: "Atorvastatin 20 mg",
    shortName: "Atorvastatin",
    cardNote: "",
    cells: allDays(ROW_PM),
    perCell: 1,
    shape: "oval",
    color: new vec4(1.0, 0.55, 0.78, 1), // pink oval
    onShelf: false,
  },
  {
    id: "vitaminD",
    displayName: "Vitamin D",
    shortName: "Vitamin D",
    cardNote: "",
    cells: [{day: 6, row: ROW_AM}],
    perCell: 1,
    shape: "capsule",
    color: new vec4(1.0, 0.66, 0.15, 1), // amber capsule
    onShelf: true,
  },
]

export function bottleIndex(id: string): number {
  for (let i = 0; i < BOTTLES.length; i++) if (BOTTLES[i].id === id) return i
  return -1
}

export function bottleById(id: string): BottleDef | null {
  const i = bottleIndex(id)
  return i >= 0 ? BOTTLES[i] : null
}

/** "MON_AM", "SUN_PM" … — used in scene object names (Cell_MON_AM). */
export function cellKey(day: number, row: number): string {
  return DAY_NAMES[day] + "_" + ROW_NAMES[row]
}

/** 1 → "1", 0.5 → "½", 2.5 → "2½", 0 → "". Never "0.5". */
export function formatCount(n: number): string {
  const whole = Math.floor(n + 1e-6)
  const half = n - whole > 0.25
  if (whole === 0 && half) return "½"
  if (whole === 0) return ""
  return half ? whole + "½" : "" + whole
}

/** Stable scene-object names (LEAF tests and the bootstrap rely on these). */
export const SCENE_NAMES = {
  bottlePrefix: "Bottle_", // Bottle_Metformin … (authored)
  bottleTickPrefix: "BottleTick_", // BottleTick_Metformin (runtime)
  cellPrefix: "Cell_", // Cell_MON_AM (runtime)
  cellRingPrefix: "CellRing_",
  cellCountPrefix: "CellCount_", // CellCount_MON_AM (Text)
  cellIconPrefix: "CellIcon_", // CellIcon_MON_AM_0 … _3
  dayLabelPrefix: "DayLabel_", // DayLabel_MON (Text)
  progressDotPrefix: "ProgressDot_", // ProgressDot_0 … _4
  progressDotFillPrefix: "ProgressDotFill_",
  weekReady: "WeekReady",
  weekReadyText: "WeekReadyText",
  cornerTick: "BoxCornerTick",
  card: "BottleCard",
  cardTitle: "BottleCardTitle",
  cardNote: "BottleCardNote",
  doneButton: "DoneButton",
  undoButton: "UndoButton",
  doneLabel: "DoneButtonLabel",
  arrow: "OutOfViewArrow",
  arrowText: "OutOfViewArrowText",
}
