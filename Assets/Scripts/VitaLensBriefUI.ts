// VitalLens Shift overview (redesign Slice 1, storyboard view 1). Passive view on
// the bed-anchored card: "Morning shift · Ward 7A", "Your assigned patients", four
// bed rows (number, short name, one line, time) with the routine bed (Bed 2)
// highlighted, and three counters (Assigned, Obs due, Meds due). All text comes
// from the fictional fixtures through selectWardFlags. Choosing a bed only opens
// the wristband check; it never verifies a patient.
//
// Measurements are the storyboard's, in cm at 110 cm: panel 40 cm wide; rows
// 5.6 cm tall with 0.8 cm gaps and 0.6 cm side padding; columns 2.8 cm (number),
// flexible (name and line), time, 2.2 cm (arrow). Type: bed number 1.6 cm, title
// 1.8 cm, names, times and counter values 1.4 cm or more, labels 1.2 cm. Solid
// colours only; text is never shrunk to fit; nothing animates.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import type {BedId} from "./Core/EncounterTypes"
import {ROUTINE_BED_ID} from "./Core/EncounterFixtures"
import type {selectWardFlags} from "./Core/EncounterSelectors"
import {applyTextRole, button, CARD, COLOR, flexColumn, flexRow, image, makeText, obj, panel, setInactive, setText, setWeight, show, text, UiButton} from "./VitaLensSharedUI"

type WardView = ReturnType<typeof selectWardFlags>

const ICON_GO = requireAsset("../Icons/Storyboard/next.png") as Texture

const BED_ORDER: readonly BedId[] = ["bed1", "bed2", "bed3", "bed4"]

// Storyboard geometry (cm).
const PANEL_W = 40
const PAD = 1.2
const INNER = PANEL_W - 2 * PAD
const GAP = 1.2
const ROW_H = 5.6
const ROW_GAP = 0.8
const ROW_PAD = 0.6
const COL_NUM = 2.8
const COL_GO = 2.2
const COL_DUE = 4.2
const COL_GAP = 0.8
const HEAD_H = 5.3
const COUNTS_H = 4.4
const SESSION_H = 1.6
const ROWS_H = 4 * ROW_H + 3 * ROW_GAP
const PANEL_H = PAD + HEAD_H + GAP + ROWS_H + GAP + COUNTS_H + ROW_GAP + SESSION_H + PAD

/** Sets a Text's em height in cm (Label role scaled; Label is 1.0 cm) and weight. */
function size(t: Text, emCm: number, weight: number): Text {
  applyTextRole(t, "Label", emCm)
  setWeight(t, weight)
  return t
}

interface Row {
  readonly button: UiButton
  readonly num: Text
  readonly name: Text
  readonly line: Text
  readonly due: Text
  readonly go: SceneObject
}

@component
export class VitaLensBriefUI extends BaseScriptComponent {
  private readonly _onSelectBed = new Event<BedId>()
  get onSelectBed(): PublicApi<BedId> {
    return this._onSelectBed.publicApi()
  }

  private briefWindow!: SceneObject
  private eyebrow!: Text
  private title!: Text
  private sub!: Text
  private session!: Text
  private rows: Row[] = []
  private counterValues: Text[] = []
  private counterLabels: Text[] = []

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const p = panel(this.sceneObject, "BriefWindow", PANEL_W, PANEL_H, new vec3(0, CARD.top - PANEL_H / 2, 0), {gap: GAP, padX: PAD, padY: PAD})
    this.briefWindow = p.root

    const head = flexColumn(p.column, INNER, HEAD_H, {gap: 0.15, justify: FlexJustify.Center})
    this.eyebrow = size(text(head, "", "Label", INNER, 1.44, {color: COLOR.inkSoft, name: "BriefEyebrow"}), 1.2, 500)
    this.title = size(text(head, "", "Title", INNER, 2.16, {name: "BriefTitle"}), 1.8, 700)
    this.sub = size(text(head, "", "Label", INNER, 1.44, {color: COLOR.inkSoft, name: "BriefSub"}), 1.2, 500)

    const list = flexColumn(p.column, INNER, ROWS_H, {gap: ROW_GAP})
    BED_ORDER.forEach((bedId, i) => this.rows.push(this.makeRow(list, i + 1, bedId)))

    const counts = flexRow(p.column, INNER, COUNTS_H, {gap: 0.6, justify: FlexJustify.SpaceBetween})
    const colW = (INNER - 2 * 0.6) / 3
    for (let i = 0; i < 3; i++) {
      const col = flexColumn(counts, colW, COUNTS_H, {gap: 0.3, justify: FlexJustify.Center})
      this.counterValues.push(size(text(col, "", "Label", colW, 2.2, {align: "center", name: "BriefCountValue" + (i + 1)}), 1.6, 700))
      this.counterLabels.push(size(text(col, "", "Label", colW, 1.5, {color: COLOR.inkSoft, align: "center", name: "BriefCountLabel" + (i + 1)}), 1.2, 500))
    }
    // Simulation disclosure kept from the earlier prototype (requirement G01), below the storyboard content.
    this.session = size(text(p.column, "", "Label", INNER, SESSION_H, {color: COLOR.system, name: "BriefSession"}), 1.2, 500)
  }

  private makeRow(list: SceneObject, n: number, bedId: BedId): Row {
    const w = INNER
    // UI Kit applies the style when the button is created (a later setVariant did not
    // repaint in preview), so the routine bed's row is built in the Primary style.
    const primary = bedId === ROUTINE_BED_ID
    const b = button(list, "BtnBed" + n, "", w, ROW_H, () => this._onSelectBed.invoke(bedId), {style: primary ? "Primary" : "PrimaryNeutral"})
    const host = b.button.sceneObject
    const z = 0.08
    const left = -w / 2 + ROW_PAD
    const right = w / 2 - ROW_PAD
    const goX = right - COL_GO / 2
    const dueRight = right - COL_GO - COL_GAP
    const textLeft = left + COL_NUM + COL_GAP
    const textW = dueRight - COL_DUE - COL_GAP - textLeft

    const num = size(makeText(obj(host, "BedNumber" + n, new vec3(left + COL_NUM / 2, 0, z)), String(n), "Label", COL_NUM, COL_NUM, {align: "center"}), 1.6, 700)
    const name = size(makeText(obj(host, "BedName" + n, new vec3(textLeft + textW / 2, 0.85, z)), "", "Label", textW, 1.82), 1.4, 600)
    const line = size(makeText(obj(host, "BedLine" + n, new vec3(textLeft + textW / 2, -0.9, z)), "", "Label", textW, 1.56, {color: COLOR.inkSoft}), 1.2, 500)
    const due = size(makeText(obj(host, "BedDue" + n, new vec3(dueRight - COL_DUE / 2, 0, z)), "", "Label", COL_DUE, 1.82, {align: "right"}), 1.4, 600)
    const goHost = obj(host, "BedGo" + n, new vec3(goX, 0, 0))
    image(goHost, ICON_GO, COL_GO, new vec3(0, 0, z))
    return {button: b, num, name, line, due, go: goHost}
  }

  render(v: WardView): void {
    show(this.briefWindow, v.briefVisible)
    setText(this.eyebrow, v.header.eyebrow)
    setText(this.title, v.header.title)
    setText(this.sub, v.header.sub)
    setText(this.session, v.sessionLabel)
    v.brief.forEach((row, i) => {
      const r = this.rows[i]
      if (!r) return
      setText(r.num, String(row.bedNumber))
      setText(r.name, row.name)
      setText(r.line, row.row)
      setText(r.due, row.due)
      // The routine bed is the one accent row with the arrow (storyboard .shiftrow.pri).
      show(r.go, row.highlighted)
      setInactive(r.button.button, !row.select.enabled)
    })
    v.counters.forEach((c, i) => {
      if (this.counterValues[i]) setText(this.counterValues[i], String(c.value))
      if (this.counterLabels[i]) setText(this.counterLabels[i], c.label)
    })
  }
}
