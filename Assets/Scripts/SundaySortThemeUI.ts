/**
 * SundaySortThemeUI — shared UI-layer helpers for the Sunday Sort *UI.ts modules.
 *
 * Owns: the type scale (applyTextRole / roleSize, per the specs-build-ui
 *       convention), the "digit height → Text.size" conversion used by the
 *       floating cell counts, and tintPlate() which re-colours a UIKit BackPlate
 *       so panels stay bright on the additive display instead of dark glass.
 * Expects: to be imported by UI modules only.
 * Must NOT: hold state or build panels itself.
 */
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

/** Content in this Lens sits ~60 cm away (the brief), not the 110 cm UIKit default. */
export const VIEW_DISTANCE_CM = 60

const FONT_SIZE_SCALE = 1.0 // system font

export type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}

export function roleSize(role: TextRole, distanceCm: number = VIEW_DISTANCE_CM): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

export function applyTextRole(t: Text, role: TextRole, distanceCm: number = VIEW_DISTANCE_CM): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

/**
 * Text.size for a wanted DIGIT height in cm. Text.size is the em-square
 * (em cm = size / 43.886); digits are ~0.7 em tall in the system font.
 */
export function sizeForDigitHeight(heightCm: number): number {
  return (heightCm / 0.7) * 43.886 * FONT_SIZE_SCALE
}

/** Common raw-Text setup: centred, never wrapping, depth-tested, bold. */
export function setupText(t: Text, text: string, color: vec4, widthCm: number, heightCm: number): void {
  t.text = text
  t.depthTest = true
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  t.textFill.color = color
  ;(t as Text & {weight?: number}).weight = 700
}

/** Re-colour a BackPlate's RoundedRectangle (call after the BackPlate has initialised). */
export function tintPlate(plateHost: SceneObject, background: vec4, border: vec4, borderSizeCm: number): void {
  const rr = plateHost.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  if (!rr) return
  rr.gradient = false
  rr.backgroundColor = background
  rr.border = true
  rr.borderSize = borderSizeCm
  rr.borderColor = border
}

/**
 * Dark outline behind floating text. On the additive display dark renders as
 * see-through, so this changes nothing on glasses; in the preview it keeps the
 * counts readable where they float in front of the white bottles.
 */
export const TEXT_OUTLINE = new vec4(0.03, 0.06, 0.12, 1)

export function outlineText(t: Text, alpha: number = 1, size: number = 0.3): void {
  t.outlineSettings.enabled = true
  t.outlineSettings.size = size
  t.outlineSettings.fill.color = withAlpha(TEXT_OUTLINE, alpha)
}

export function withAlpha(c: vec4, a: number): vec4 {
  return new vec4(c.x, c.y, c.z, c.w * a)
}
