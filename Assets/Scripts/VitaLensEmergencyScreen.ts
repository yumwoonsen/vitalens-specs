// VitalLens Scenario 3 screens (s3-em-travel, s3-em-bed, s3-em-mismatch, s3-em-flipped).
// selectEmergencyScreen projects the encounter state; EmergencyCard draws the red-outlined
// card on the bedside panel and on the travelling HUD, and only emits encounter events.
// Patient facts and band state come from Core; fixed wording is the storyboard's.
//
// Measurements are the s3-* states in lens-spec.json at UI_SCALE. Text floors and the 4 cm
// button rule keep some items larger than a straight scale, as noted beside them.
import {selectCards} from "./Core/CardPresentation"
import {canDispatch} from "./Core/EncounterReducer"
import type {EncounterEvent, EncounterState} from "./Core/EncounterTypes"
import {applyTextRole, box, Box, cm, hex, label, placeBox, placeLabel, setBorder, setSolidEnabled, setText, setWeight, show, solidButton, SolidButton} from "./VitaLensSharedUI"

export interface EmergencyView {
  readonly surface: "travel" | "bed"
  readonly corner: "left" | "right"
  readonly drill: string
  readonly name: string
  readonly age: string
  readonly bedLine: string
  readonly band: "none" | "matched" | "mismatch"
  readonly status: string
  readonly risks: readonly string[]
  readonly context: string
  readonly vitals: readonly {label: string; display: string; unit: string}[]
  readonly temp: string
  readonly callLabel: string
  readonly callEnabled: boolean
  readonly scanEnabled: boolean
  readonly cornerEvent: EncounterEvent
}

/** Null when these screens do not cover the state (privacy and the briefing keep the older card). */
export function selectEmergencyScreen(s: EncounterState, seconds: number): EmergencyView | null {
  if (s.phase !== "emergency" || s.privacy || s.emergencyBrief) return null
  const v = selectCards(s, seconds)
  const parts = v.subtitle.split(" · ")
  const other = v.rows.filter((r) => r.kind !== "risk")
  return {
    surface: v.travel ? "travel" : "bed",
    corner: v.corner,
    // Core's string is a full sentence; the band shows only its clock.
    drill: "Drill " + (/\d+:\d+/.exec(v.timer)?.[0] ?? "") + " · not saved",
    name: v.title,
    age: (parts[2] ?? "").replace(" years", ""),
    bedLine: (parts[1] ?? "") + " · " + (parts[3] ?? ""),
    band: s.emergencyBand === "matched" ? "matched" : s.emergencyBand === "mismatch" ? "mismatch" : "none",
    status: v.status,
    risks: v.rows.filter((r) => r.kind === "risk").map((r) => r.label + "\n" + r.value),
    context: other.find((r) => r.label === "Relevant context")?.value ?? "Unknown",
    vitals: v.vitals,
    temp: other.find((r) => r.label === "Temp")?.value ?? "Unknown",
    callLabel: s.emergencyContact && v.contact ? v.contact : "Call doctor",
    callEnabled: canDispatch(s, {type: "EMERGENCY_CONTACT"}),
    scanEnabled: canDispatch(s, {type: "EMERGENCY_SCAN"}),
    cornerEvent: {type: "SET_MINI_CORNER", corner: v.corner === "right" ? "left" : "right"},
  }
}

const WHITE = hex("#FFFFFF")
const SOFT = hex("#C9D1D8")
const ROW = hex("#4B5563")
const RED_FILL = hex("#B91C1C")
const RED_LINE = hex("#EF4444")
const RED_TEXT = hex("#F87171")
const CAUTION = hex("#FCD34D")
const VERIFIED = hex("#34D399")
const VERIFIED_FILL = hex("#34D399", 0.18)
const NEUTRAL_FILL = hex("#FFFFFF", 0.12)
const NEUTRAL_LINE = hex("#FFFFFF", 0.3)
const CLEAR = hex("#000000", 0)
/** The outline's width; the band and dividers sit inside it, as in the spec. */
const OUTLINE = 0.17

// Card layout, from the card's top-left. Text keeps its size floors and buttons keep 4 cm.
const BTN_H = 4
const NAME_FONT = 1.6
// Measured: "Mdm Tan Ah Lian" is 12.93 cm at 1.6 cm.
const CHAR_W_NAME = 12.93 / 15
const AGE_GAP = cm(0.6)
const AGE_W = 2
const HAIRLINE = hex("#FFFFFF", 0.12)
const RISK_BAR = cm(0.3)
const RISK_INDENT = RISK_BAR + cm(0.6)
const VITAL_GAP = cm(0.6)
const PILL_H = cm(3.2)
// Measured text at 1.4 cm plus the spec's padding on both sides.
const PILL_PAD = cm(1.1)
const PILL_W = {none: 11.54 + 2 * PILL_PAD, matched: 9.13 + 2 * PILL_PAD, mismatch: 11.84 + 2 * PILL_PAD}
const PILL_LABEL = {none: "Band not scanned", matched: "Band matches", mismatch: "ID mismatch, stop"}
const RISK_H = 2.9
const VITAL_LABEL_H = 1.3
const VITAL_VALUE_H = 1.7
const VITAL_H = VITAL_LABEL_H + VITAL_VALUE_H
const VALUE_CHAR = 0.87
/** Space Core's mismatch line takes on the bedside card. */
export const STATUS_H = 1.5
// The travelling pill: the spec's 4 cm height at UI_SCALE with a full 4 cm click area, wider
// than the spec's 9.08 scaled. Its text is 1.4 cm, not the spec's 1.6, by owner decision.
const CALL_W_TRAVEL = 8.68
const CALL_H_TRAVEL = cm(4)
const CALL_FONT = 1.4
/** "Call simulated" fits the pill on one line at this size. */
const CALL_DONE_FONT = 1.2
/** Clear of the card's right outline, measured from its inner edge. */
const CALL_INSET = OUTLINE + 0.8
const CALL_BELOW_BAND = 0.5

// Deliberate deviation: the spec's 23.2 cm (29 at UI_SCALE) cannot hold the name and age at
// their floors beside the pill, so the card is as wide as that row needs, about the spec's centre.
export const TRAVEL_W = 26
export const TRAVEL_H = cm(22.27)
const TRAVEL_CX = cm(10.04)
const TRAVEL_CY = cm(19.41)

/** Centre of the travelling card in view cm (elements_view_cm.trav), mirrored by the corner toggle. */
export function travelCentre(corner: "left" | "right"): {x: number; y: number} {
  return {x: (corner === "right" ? 1 : -1) * TRAVEL_CX, y: TRAVEL_CY}
}

// The Bed 3 pin and edge arrow, in cm on the 110 cm plane. The pin keeps this size at any distance.
const VIEW_DEPTH = 110
const FRAME_W = 53
const FRAME_H = 77
const FRAME_MARGIN = 2
const CARD_CLEARANCE = 0.5
// Its two lines keep their floors, so it is a little taller than the spec's 4.4 scaled.
export const BED_PIN = {w: cm(10.4), pill: 3.8, pointer: cm(1.6), radius: cm(1.2)}
// "Bed 3" at 1.6 cm and the arrow, wider than the spec's 9.6 scaled so both fit.
export const BED_ARROW = {w: 8.1, h: cm(3.6)}

/** What a pin and its edge arrow say and how they are coloured. Size, blink and behaviour are shared. */
export interface BedMarkerStyle {
  readonly title: string
  readonly sub: string
  readonly arrowLabel: string
  readonly fill: vec4
  readonly ink: vec4
}
export const CODE_BLUE_MARKER: BedMarkerStyle = {title: "Bed 3", sub: "Code Blue", arrowLabel: "Bed 3", fill: hex("#B91C1C"), ink: hex("#FFFFFF")}
// The fill is the `system` blue from tokens_css in lens-spec.json. It is pale, so the text is `ground`.
export const SCAN_MARKER: BedMarkerStyle = {title: "Scan", sub: "wristband", arrowLabel: "Scan", fill: hex("#7DD3FC"), ink: hex("#101316")}

export type BedMarker = {readonly kind: "pin"} | {readonly kind: "arrow"; readonly x: number; readonly y: number; readonly angle: number}

/**
 * The pin when all of it is in the frame and clear of the card, otherwise the edge arrow
 * on the nearest frame edge. x, y and z are the pin's tip in camera space, z ahead.
 */
export function selectBedMarker(x: number, y: number, z: number, corner: "left" | "right", avoidTravelCard: boolean = true): BedMarker {
  const c = travelCentre(corner)
  const card = {l: c.x - TRAVEL_W / 2, r: c.x + TRAVEL_W / 2, t: c.y + TRAVEL_H / 2, b: c.y - TRAVEL_H / 2}
  const front = z >= 5
  const px = front ? (x * VIEW_DEPTH) / z : x
  const py = front ? (y * VIEW_DEPTH) / z : y
  const top = py + BED_PIN.pill + BED_PIN.pointer
  const inFrame = Math.abs(px) + BED_PIN.w / 2 <= FRAME_W / 2 - FRAME_MARGIN && py >= -FRAME_H / 2 + FRAME_MARGIN && top <= FRAME_H / 2 - FRAME_MARGIN
  const onCard = avoidTravelCard && px + BED_PIN.w / 2 > card.l && px - BED_PIN.w / 2 < card.r && top > card.b && py < card.t
  if (front && inFrame && !onCard) return {kind: "pin"}

  const dx = Math.hypot(px, py) < 1e-6 ? 1 : px
  const maxX = FRAME_W / 2 - FRAME_MARGIN - BED_ARROW.w / 2
  const maxY = FRAME_H / 2 - FRAME_MARGIN - BED_ARROW.h / 2
  const clamp = (v: number, m: number): number => Math.max(-m, Math.min(m, v))
  const horizontal = Math.abs(dx) / (FRAME_W / 2) >= Math.abs(py) / (FRAME_H / 2)
  const ax = horizontal ? Math.sign(dx) * maxX : clamp(front ? dx : 0, maxX)
  let ay = horizontal ? clamp(front ? py : 0, maxY) : Math.sign(py) * maxY
  const onCardToo = avoidTravelCard && ax + BED_ARROW.w / 2 > card.l && ax - BED_ARROW.w / 2 < card.r && ay + BED_ARROW.h / 2 > card.b && ay - BED_ARROW.h / 2 < card.t
  if (onCardToo) ay = card.b - CARD_CLEARANCE - BED_ARROW.h / 2
  return {kind: "arrow", x: ax, y: ay, angle: Math.atan2(py, dx)}
}

const LAYOUT = {
  bed: {pad: cm(0.97), band: cm(4.63), title: 0.51, drill: 1.93, name: 3.87, bedLine: 5.74, pill: cm(5.38), risksLine: cm(9.33), risks: 7.78, contextLine: cm(13.77), context: 11.27, vitalsLine: cm(16.53), vitals: 13.62, temp: 17.1, footLine: cm(23.94), buttons: cm(24.82)},
  travel: {pad: cm(0.97), band: cm(4.39), title: 0.51, drill: 1.84, name: 3.88, bedLine: 5.75, pill: 0, risksLine: cm(9.58), risks: 8.1, contextLine: cm(14.32), context: 11.8, vitalsLine: cm(17.28), vitals: 14.3, temp: 0, footLine: 0, buttons: cm(4.39) + CALL_BELOW_BAND},
}
/** Height of the bedside card, before Core's mismatch line. */
export const BED_CARD_H = LAYOUT.bed.buttons + BTN_H + LAYOUT.bed.pad

export class EmergencyCard {
  private view: EmergencyView | null = null
  private readonly outline: Box
  private readonly drill: Text
  private readonly name: Text
  private readonly age: Text
  private readonly bedLine: Text
  private readonly pill: Box | null = null
  private readonly pillText: Text | null = null
  private readonly risks: Text[] = []
  private readonly context: Text
  private readonly vitalLabels: Text[] = []
  private readonly vitalSubs: Text[] = []
  private readonly vitalValues: Text[] = []
  private readonly vitalUnits: Text[] = []
  private readonly tempLabel: Text | null = null
  private readonly tempValue: Text | null = null
  private readonly status: Text | null = null
  private readonly scanBtn: SolidButton | null = null
  private readonly callBtn: SolidButton

  constructor(
    root: SceneObject,
    private readonly x: number,
    private readonly y: number,
    private readonly w: number,
    h: number,
    private readonly travel: boolean,
    private readonly emit: (e: EncounterEvent) => void,
  ) {
    const L = travel ? LAYOUT.travel : LAYOUT.bed
    const P = L.pad
    const X = x + P
    const inner = w - 2 * P
    // Raised so the band and dividers cannot draw over it and clip its sides.
    this.outline = box(root, x, y, w, h, CLEAR, cm(1.2), {w: OUTLINE, c: RED_LINE}, true)

    // Red band, inside the outline.
    // Rounded on top only: the lower part is a square box over the rounded one.
    box(root, x + OUTLINE, y + OUTLINE, w - 2 * OUTLINE, L.band - OUTLINE, RED_FILL, cm(1.2) - OUTLINE)
    box(root, x + OUTLINE, y + 1, w - 2 * OUTLINE, L.band - 1, RED_FILL)
    const dot = cm(1)
    const dotY = y + L.title + (1.4 - dot) / 2
    box(root, X, dotY, dot, dot, RED_LINE, dot / 2, {w: cm(0.12), c: WHITE}, true)
    label(root, X + dot + cm(0.7), y + L.title, 10, 1.4, "CODE BLUE", 1.4, 700, WHITE, {name: "EmergencyBandTitle"})
    label(root, x + w - P - 6, y + L.title, 6, 1.4, "BED 3", 1.4, 700, WHITE, {align: "right", name: "EmergencyBandBed"})
    this.drill = label(root, X, y + L.drill, inner, 1.4, "", 1.17, 400, WHITE, {name: "EmergencyDrill"})

    // Dividers between the sections.
    for (const line of [L.risksLine, L.contextLine, L.vitalsLine, L.footLine]) if (line > 0) box(root, x + OUTLINE, y + line, w - 2 * OUTLINE, 0.08, HAIRLINE)

    // Who.
    this.name = label(root, X, y + L.name, 15, 2, "", NAME_FONT, 700, WHITE, {name: "EmergencyName"})
    this.age = label(root, X, y + L.name, AGE_W, 2, "", 1.4, 500, SOFT, {name: "EmergencyAge"})
    this.bedLine = label(root, X, y + L.bedLine, 14, 1.3, "", 1.17, 400, SOFT, {name: "EmergencyBedLine"})

    // Risks.
    const riskW = (inner - cm(0.8)) / 2
    for (let i = 0; i < 2; i++) {
      const rx = X + i * (riskW + cm(0.8))
      box(root, rx, y + L.risks, RISK_BAR, RISK_H, CAUTION)
      this.risks.push(label(root, rx + RISK_INDENT, y + L.risks, riskW - RISK_INDENT, RISK_H, "", 1.2, 600, CAUTION, {name: "EmergencyRisk" + i, wrap: true}))
    }
    this.context = label(root, X, y + L.context, inner, 1.7, "", 1.4, 600, WHITE, {name: "EmergencyContext"})

    // Vitals.
    const colW = (inner + VITAL_GAP) / 3
    for (let i = 0; i < 3; i++) {
      const vx = X + i * colW
      const vy = y + L.vitals
      this.vitalLabels.push(label(root, vx, vy, colW - 0.2, VITAL_LABEL_H, "", 1.17, 400, SOFT, {name: "EmergencyVitalLabel" + i}))
      this.vitalSubs.push(label(root, vx + 2.25, vy + 0.3, 1, 1.2, "2", 0.8, 400, SOFT))
      this.vitalValues.push(label(root, vx, vy + VITAL_LABEL_H, colW, VITAL_VALUE_H, "", 1.6, 600, WHITE, {name: "EmergencyVitalValue" + i}))
      this.vitalUnits.push(label(root, vx, vy + VITAL_LABEL_H + 0.1, 4, 1.5, "", 1.17, 400, SOFT, {name: "EmergencyVitalUnit" + i}))
    }

    if (travel) {
      this.callBtn = this.button(root, "BtnCallDoctor", x + w - CALL_INSET - CALL_W_TRAVEL, y + L.buttons, CALL_W_TRAVEL, RED_FILL, () => this.fire({type: "EMERGENCY_CONTACT"}), CALL_FONT, CALL_H_TRAVEL)
      return
    }

    this.pill = box(root, 0, y + L.pill, PILL_W.none, PILL_H, NEUTRAL_FILL, PILL_H / 2, {w: 0.08, c: NEUTRAL_LINE})
    this.pillText = label(root, 0, y + L.pill, PILL_W.none, PILL_H, "", 1.4, 700, WHITE, {align: "center", name: "EmergencyBandState"})
    this.tempLabel = label(root, X, y + L.temp, 4, 1.5, "Temp", 1.17, 400, SOFT, {name: "EmergencyTempLabel"})
    this.tempValue = label(root, X + 3.5, y + L.temp, 12, 1.5, "", 1.4, 600, CAUTION, {name: "EmergencyTemp"})
    this.status = label(root, X, y + L.footLine + 0.2, inner, 1.4, "", 1.2, 500, RED_TEXT, {name: "EmergencyStatus"})
    const halfW = (inner - cm(1.2)) / 2
    this.scanBtn = this.button(root, "BtnEmergencyScan", X, y + L.buttons, halfW, ROW, () => this.fire({type: "EMERGENCY_SCAN"}), 1.4)
    this.scanBtn.labels[0].text = "Scan"
    this.callBtn = this.button(root, "BtnCallDoctor", X + halfW + cm(1.2), y + L.buttons, halfW, RED_FILL, () => this.fire({type: "EMERGENCY_CONTACT"}), 1.6)
  }

  /** Drawn at h, clicked at the full 4 cm. */
  private button(root: SceneObject, name: string, x: number, y: number, w: number, fill: vec4, onTap: () => void, font: number, h: number = BTN_H): SolidButton {
    const b = solidButton(root, name, x, y, w, h, fill, h / 2, onTap, undefined, BTN_H)
    b.labels.push(label(b.face, 0, 0, w, h, "", font, 700, WHITE, {align: "center", name: name + "Label"}))
    return b
  }

  private fire(e: EncounterEvent): void {
    if (this.view) this.emit(e)
  }

  /** Bedside height: taller while Core's mismatch line shows. */
  static bedCardHeight(v: EmergencyView): number {
    return BED_CARD_H + (v.band === "mismatch" ? STATUS_H : 0)
  }

  render(v: EmergencyView): void {
    this.view = v
    const L = this.travel ? LAYOUT.travel : LAYOUT.bed
    const X = this.x + L.pad
    setText(this.drill, v.drill)
    setText(this.name, v.name)
    placeLabel(this.age, X + v.name.length * CHAR_W_NAME + AGE_GAP, this.y + L.name, AGE_W, 2)
    setText(this.age, v.age)
    setText(this.bedLine, v.bedLine)
    this.risks.forEach((t, i) => setText(t, v.risks[i] ?? ""))
    setText(this.context, v.context)

    const inner = this.w - 2 * L.pad
    const colW = (inner + VITAL_GAP) / 3
    this.vitalLabels.forEach((t, i) => {
      const m = v.vitals[i]
      const vx = X + i * colW
      const isBp = m !== undefined && m.label.startsWith("BP")
      setText(t, m ? m.label.replace("₂", "") : "")
      show(this.vitalSubs[i].getSceneObject(), m !== undefined && m.label.includes("₂"))
      setText(this.vitalValues[i], m ? m.display : "", isBp ? WHITE : CAUTION)
      // The travelling HUD has no room for BP's unit, as in the storyboard.
      setText(this.vitalUnits[i], m && !(this.travel && isBp) ? m.unit : "")
      if (m) placeLabel(this.vitalUnits[i], vx + m.display.length * VALUE_CHAR + 0.5, this.y + L.vitals + VITAL_LABEL_H + 0.1, 4, 1.5)
    })

    setText(this.callBtn.labels[0], v.callLabel)
    if (this.travel) {
      applyTextRole(this.callBtn.labels[0], "Label", v.callEnabled ? CALL_FONT : CALL_DONE_FONT)
      setWeight(this.callBtn.labels[0], 700)
    }
    setSolidEnabled(this.callBtn, v.callEnabled)
    if (this.travel) return

    const bad = v.band === "mismatch"
    const ok = v.band === "matched"
    const h = EmergencyCard.bedCardHeight(v)
    placeBox(this.outline, this.x, this.y, this.w, h)
    const pillW = PILL_W[v.band]
    const pillX = this.x + this.w - L.pad - pillW
    const pillY = this.y + L.pill
    if (this.pill && this.pillText) {
      placeBox(this.pill, pillX, pillY, pillW, PILL_H)
      this.pill.rr.backgroundColor = ok ? VERIFIED_FILL : NEUTRAL_FILL
      setBorder(this.pill.rr, bad ? {w: 0.17, c: RED_LINE} : ok ? {w: 0.08, c: VERIFIED} : {w: 0.08, c: NEUTRAL_LINE})
      placeLabel(this.pillText, pillX, pillY, pillW, PILL_H)
      setText(this.pillText, PILL_LABEL[v.band], ok ? VERIFIED : WHITE)
    }
    if (this.tempValue) setText(this.tempValue, v.temp)
    if (this.status) {
      show(this.status.getSceneObject(), bad)
      setText(this.status, v.status)
    }
    const statusH = bad ? STATUS_H : 0
    const btnY = this.y + L.buttons + statusH
    for (const b of [this.scanBtn, this.callBtn]) {
      if (b) {
        const p = b.cell.getTransform().getLocalPosition()
        b.cell.getTransform().setLocalPosition(new vec3(p.x, -btnY, p.z))
      }
    }
    if (this.scanBtn) setSolidEnabled(this.scanBtn, v.scanEnabled)
  }
}
