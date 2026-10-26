/**
 * SundaySortState — pure state machine for one sorting session.
 *
 * Owns: which bottle is selected, which bottles are done, and the mode
 *       ("sorting" → "checking" → "finished", then the stretch "doseChange" and
 *       back to "finished"). Computes what each cell should show for a selected
 *       bottle, for check mode, and for the doctor's change.
 * Expects: nothing (no scene access, no timers) — SundaySortMain drives it.
 * Must NOT: touch the scene, UI, or audio. Each run starts with an empty box.
 */
import {BOTTLES, BottleDef, DOSE_CHANGE, PillShape, bottleById, cellKey, formatCount} from "./SundaySortData"

export type SortMode = "sorting" | "checking" | "finished" | "doseChange"

export interface CellIconView {
  shape: PillShape
  color: vec4
}

export interface CellView {
  key: string
  day: number
  row: number
  countText: string
  icons: CellIconView[]
}

export class SundaySortState {
  private _selected: string | null = null
  private _done: {[id: string]: boolean} = {}
  private _mode: SortMode = "sorting"
  private _doseChangeApplied = false

  get selected(): string | null {
    return this._selected
  }

  get mode(): SortMode {
    return this._mode
  }

  isDone(id: string): boolean {
    return this._done[id] === true
  }

  doneIds(): string[] {
    return BOTTLES.filter((b) => this._done[b.id] === true).map((b) => b.id)
  }

  remaining(): BottleDef[] {
    return BOTTLES.filter((b) => this._done[b.id] !== true)
  }

  allDone(): boolean {
    return this.remaining().length === 0
  }

  /** Select a bottle (re-selecting a done bottle is allowed, to fix it). */
  select(id: string): boolean {
    if (this._mode === "finished" || this._mode === "doseChange") return false
    if (!bottleById(id)) return false
    this._selected = id
    return true
  }

  /** Mark the selected bottle done. Returns its id, or null if nothing was selected. */
  markDone(): string | null {
    if (this._mode === "finished" || this._mode === "doseChange" || this._selected === null) return null
    const id = this._selected
    this._done[id] = true
    this._selected = null
    if (this.allDone()) this._mode = "checking"
    return id
  }

  /** Clear the selection without marking anything done. */
  clearSelection(): string | null {
    const id = this._selected
    this._selected = null
    return id
  }

  /** "All checked": only valid in check mode with nothing selected. */
  finishWeek(): boolean {
    if (this._mode !== "checking" || this._selected !== null) return false
    this._mode = "finished"
    return true
  }

  get doseChangeApplied(): boolean {
    return this._doseChangeApplied
  }

  /** Stretch: the doctor's change can be opened once, after the week is finished. */
  startDoseChange(): boolean {
    if (this._mode !== "finished" || this._doseChangeApplied) return false
    this._mode = "doseChange"
    return true
  }

  /** The changed cells were fixed (Done): the schedule now has the change. */
  applyDoseChange(): boolean {
    if (this._mode !== "doseChange") return false
    this._doseChangeApplied = true
    this._mode = "finished"
    return true
  }

  /** Undo while the change is shown: back to the finished week, change still pending. */
  cancelDoseChange(): boolean {
    if (this._mode !== "doseChange") return false
    this._mode = "finished"
    return true
  }

  /** Cells the doctor's change touches: "-1" and the changed bottle's icon. */
  cellsForDoseChange(): CellView[] {
    const b = bottleById(DOSE_CHANGE.bottleId)
    if (!b) return []
    return DOSE_CHANGE.cells.map((c) => ({
      key: cellKey(c.day, c.row),
      day: c.day,
      row: c.row,
      countText: DOSE_CHANGE.countText,
      icons: [{shape: b.shape, color: b.color}],
    }))
  }

  doseChangeDays(): boolean[] {
    const out = [false, false, false, false, false, false, false]
    for (const c of DOSE_CHANGE.cells) out[c.day] = true
    return out
  }

  /** Cells lit by one bottle: its count and its own pill icon. */
  cellsForBottle(id: string): CellView[] {
    const b = bottleById(id)
    if (!b) return []
    return b.cells.map((c) => ({
      key: cellKey(c.day, c.row),
      day: c.day,
      row: c.row,
      countText: formatCount(b.perCell),
      icons: [{shape: b.shape, color: b.color}],
    }))
  }

  /** Days (0..6) that a bottle touches — their labels brighten. */
  litDays(id: string): boolean[] {
    const out = [false, false, false, false, false, false, false]
    const b = bottleById(id)
    if (b) for (const c of b.cells) out[c.day] = true
    return out
  }

  /** Check mode: every cell with everything that should be in it, plus the total. */
  cellsForCheck(): CellView[] {
    const out: CellView[] = []
    for (let row = 0; row < 2; row++) {
      for (let day = 0; day < 7; day++) {
        let total = 0
        const icons: CellIconView[] = []
        for (const b of BOTTLES) {
          for (const c of b.cells) {
            if (c.day === day && c.row === row && !this.removedByDoseChange(b.id, day, row)) {
              total += b.perCell
              icons.push({shape: b.shape, color: b.color})
            }
          }
        }
        if (icons.length > 0) {
          out.push({key: cellKey(day, row), day: day, row: row, countText: formatCount(total), icons: icons})
        }
      }
    }
    return out
  }

  private removedByDoseChange(id: string, day: number, row: number): boolean {
    if (!this._doseChangeApplied || id !== DOSE_CHANGE.bottleId) return false
    for (const c of DOSE_CHANGE.cells) if (c.day === day && c.row === row) return true
    return false
  }
}
