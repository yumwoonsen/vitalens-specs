// VitalLens identity gate (plan Task 7; owner round 2b compact HUD). Passive view
// on the bed-anchored card. Shows the bed's assignment beside the simulated wristband
// read, one confirm button per identifier (name, date of birth), "Doesn't match",
// "Rescan", "Back to brief" and the demo scan of the mismatched wristband, all on one
// card (no separate demo window, so nothing clips at the right). Mismatch is red:
// "ID mismatch, stop". No face, photo or score. Emits intents only.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import type {IdentifierId, WristbandChoice} from "./Core/EncounterTypes"
import type {selectIdentity} from "./Core/EncounterSelectors"
import {button, CARD, CARD_BTN_H, cardPanel, COLOR, flexColumn, flexRow, setControl, setText, show, text, UiButton} from "./VitaLensSharedUI"

type IdentityView = ReturnType<typeof selectIdentity>

const NOT_SCANNED = "Not scanned"

interface IdRow {
  readonly line: Text
  readonly band: Text
  readonly confirm: UiButton
}

@component
export class VitaLensIdentityUI extends BaseScriptComponent {
  private readonly _onScan = new Event<WristbandChoice>()
  private readonly _onConfirm = new Event<IdentifierId>()
  private readonly _onDoesntMatch = new Event<void>()
  private readonly _onRescan = new Event<void>()
  private readonly _onBackToBrief = new Event<void>()
  get onScan(): PublicApi<WristbandChoice> {
    return this._onScan.publicApi()
  }
  get onConfirm(): PublicApi<IdentifierId> {
    return this._onConfirm.publicApi()
  }
  get onDoesntMatch(): PublicApi<void> {
    return this._onDoesntMatch.publicApi()
  }
  get onRescan(): PublicApi<void> {
    return this._onRescan.publicApi()
  }
  get onBackToBrief(): PublicApi<void> {
    return this._onBackToBrief.publicApi()
  }

  private gate!: SceneObject
  private title!: Text
  private message!: Text
  private scan!: UiButton
  private rescan!: UiButton
  private scanMismatch!: UiButton
  private doesntMatch!: UiButton
  private back!: UiButton
  private rows: IdRow[] = []

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const h = CARD_BTN_H
    const g = cardPanel(this.sceneObject, "IdentityGate", 33, {gap: 0.5, padY: 0.8})
    this.gate = g.root
    this.title = text(g.column, "Identify", "Title", w, 2.4, {name: "GateTitle"})
    const scanRow = flexRow(g.column, w, h, {gap: 0.6, justify: FlexJustify.SpaceBetween})
    this.scan = button(scanRow, "BtnScanWristband", "Scan wristband (simulated)", 17, h, () => this._onScan.invoke("assigned"), {style: "Primary"})
    this.rescan = button(scanRow, "BtnRescan", "Rescan", 10, h, () => this._onRescan.invoke())
    for (const id of ["name", "dob"] as IdentifierId[]) {
      const row = flexRow(g.column, w, h + 0.6, {gap: 0.6, justify: FlexJustify.SpaceBetween})
      const col = flexColumn(row, 17, h + 0.6, {gap: 0.1, justify: FlexJustify.Center})
      const prefix = id === "name" ? "Name" : "Dob"
      const line = text(col, "", "Body", 17, 2.2, {name: "Gate" + prefix + "Assignment"})
      const band = text(col, "", "Label", 17, 1.6, {name: "Gate" + prefix + "Band"})
      const caption = id === "name" ? "Name matches" : "Date of birth\nmatches"
      const confirm = button(row, id === "name" ? "BtnConfirmName" : "BtnConfirmDob", caption, 10, h + 0.6, () => this._onConfirm.invoke(id))
      this.rows.push({line, band, confirm})
    }
    const actions = flexRow(g.column, w, h + 0.6, {gap: 0.6, justify: FlexJustify.SpaceBetween})
    this.doesntMatch = button(actions, "BtnDoesntMatch", "Doesn't\nmatch", 8.8, h + 0.6, () => this._onDoesntMatch.invoke())
    this.back = button(actions, "BtnBackToBrief", "Back to\nbrief", 8.8, h + 0.6, () => this._onBackToBrief.invoke())
    this.scanMismatch = button(actions, "BtnScanMismatch", "Scan mismatched\nband (demo)", 8.8, h + 0.6, () => this._onScan.invoke("mismatchDemo"))
    this.message = text(g.column, "", "Label", w, 2.6, {name: "GateMessage"})
  }

  render(v: IdentityView): void {
    const verified = v.verifiedSummary !== null
    show(this.gate, v.gateVisible)
    setText(this.title, v.bedLabel ? "Identify · " + v.bedLabel : "Identify", v.mismatch ? COLOR.emergency : verified ? COLOR.verified : COLOR.ink)
    setControl(this.scan, v.scan.enabled)
    setControl(this.scanMismatch, v.scanMismatch.enabled && !verified)
    setControl(this.rescan, v.rescan.enabled)
    setControl(this.doesntMatch, v.doesntMatch.enabled)
    setControl(this.back, v.backToBrief.enabled)
    v.rows.forEach((r, i) => {
      const row = this.rows[i]
      if (!row) return
      setText(row.line, r.label + ": " + r.assignment, r.confirmed ? COLOR.verified : COLOR.ink)
      const differs = r.wristband !== null && r.wristband !== r.assignment
      const bandColor = r.confirmed ? COLOR.verified : differs ? COLOR.emergency : COLOR.inkSoft
      setText(row.band, r.confirmed ? "Matched" : "Band: " + (r.wristband ?? NOT_SCANNED), bandColor)
      setControl(row.confirm, r.confirm.enabled)
    })
    if (v.mismatchMessage) setText(this.message, v.mismatchMessage, COLOR.emergency)
    else if (verified) setText(this.message, "Verified with 2 identifiers. Encounter actions unlocked.", COLOR.verified)
    else if (v.blockedReason) setText(this.message, v.blockedReason + ". Encounter actions stay locked.", COLOR.caution)
    else setText(this.message, "A bed number is not an identifier. Confirm name and date of birth.", COLOR.inkSoft)
  }
}
