// VitalLens emergency view (plan Task 9; owner round 2: D1 playback vitals, 9b single
// scan). Passive view on the bed-anchored card, in coral. Before a scan it shows a
// read-only gate with one "Scan wristband (simulated)" button. After the scan it shows
// the drill banner, the view-only drill timer, five fixed record lines with source and
// time or Unknown, the sample vitals (scripted playback, always with its badge) and
// "Call doctor (simulated)", which places no call. Emits intents only; it creates no
// clinical event and writes nothing to the record.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import type {selectEmergency} from "./Core/EncounterSelectors"
import {button, CARD, CARD_BTN_H, cardPanel, COLOR, flexRow, setControl, setText, show, text, UiButton} from "./VitaLensSharedUI"

type EmergencyView = ReturnType<typeof selectEmergency>

const VITAL_SLOTS = 4

@component
export class VitaLensEmergencyUI extends BaseScriptComponent {
  private readonly _onScan = new Event<void>()
  private readonly _onCallDoctor = new Event<void>()
  get onScan(): PublicApi<void> {
    return this._onScan.publicApi()
  }
  get onCallDoctor(): PublicApi<void> {
    return this._onCallDoctor.publicApi()
  }

  private gate!: SceneObject
  private gateNotice!: Text
  private scanBtn!: UiButton
  private card!: SceneObject
  private banner!: Text
  private drill!: Text
  private cards!: Text
  private vitals: Text[] = []
  private badge!: Text
  private provenance!: Text
  private callBtn!: UiButton
  private callNotice!: Text

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const h = CARD_BTN_H

    const g = cardPanel(this.sceneObject, "EmergencyGate", 18, {gap: 0.6, padY: 0.8})
    this.gate = g.root
    text(g.column, "Emergency (simulated drill)", "Title", w, 2.4, {color: COLOR.emergency, name: "EmergencyGateTitle"})
    this.gateNotice = text(g.column, "", "Label", w, 3.2, {color: COLOR.emergencyInk, name: "EmergencyGateNotice"})
    this.scanBtn = button(g.column, "BtnEmergencyScan", "Scan wristband", w, h, () => this._onScan.invoke(), {style: "Primary"})

    const c = cardPanel(this.sceneObject, "EmergencyCard", 35, {gap: 0.4, padY: 0.8})
    this.card = c.root
    this.banner = text(c.column, "", "Title", w, 2.4, {color: COLOR.emergency, name: "EmergencyBanner"})
    this.drill = text(c.column, "", "Label", w, 1.6, {color: COLOR.emergencyInk, name: "EmergencyDrill"})
    this.cards = text(c.column, "", "Label", w, 12.4, {color: COLOR.emergencyInk, name: "EmergencyCards"})
    const row = flexRow(c.column, w, 3.6, {gap: 0.4})
    const vw = (w - 0.4 * (VITAL_SLOTS - 1)) / VITAL_SLOTS
    for (let i = 0; i < VITAL_SLOTS; i++) this.vitals.push(text(row, "", "Body", vw, 3.6, {align: "center", name: "EmergencyVital" + i}))
    this.badge = text(c.column, "", "Label", w, 1.6, {color: COLOR.system, name: "EmergencyPlayback"})
    this.provenance = text(c.column, "", "Label", w, 2.6, {color: COLOR.inkSoft, name: "EmergencyProvenance"})
    this.callBtn = button(c.column, "BtnCallDoctor", "Call doctor", w, h, () => this._onCallDoctor.invoke())
    this.callNotice = text(c.column, "", "Label", w, 1.4, {color: COLOR.system, name: "EmergencyCallNotice"})
  }

  render(v: EmergencyView, callDoctorPressed: boolean): void {
    show(this.gate, v.showGate)
    setText(this.gateNotice, v.readOnlyNotice)
    if (this.scanBtn.label) setText(this.scanBtn.label, v.scanLabel)
    setControl(this.scanBtn, v.showGate && v.scan.enabled)

    show(this.card, v.visible)
    setText(this.banner, v.banner ?? "")
    setText(this.drill, v.drillTimer)
    setText(
      this.cards,
      v.cards.map((c) => `${c.label}: ${c.value}` + (c.source ? ` · ${c.source}, ${c.time ?? "time unknown"}` : "")).join("\n"),
    )
    this.vitals.forEach((t, i) => {
      const x = v.vitals[i]
      setText(t, x ? `${x.label}\n${x.display}${x.unit ? " " + x.unit : ""}` : "", x && x.abnormal ? COLOR.caution : COLOR.ink)
    })
    setText(this.badge, `${v.vitalsLabel}: ${v.liveNotice}`)
    // One provenance entry per source and time, e.g. "HR, SpO₂: Simulated playback, Drill +00:30".
    const groups: {key: string; labels: string[]}[] = []
    for (const x of v.vitals) {
      if (x.source === null) continue
      const key = `${x.source}, ${x.time}`
      const g = groups.find((e) => e.key === key)
      if (g) g.labels.push(x.label)
      else groups.push({key, labels: [x.label]})
    }
    setText(this.provenance, groups.map((g) => `${g.labels.join(", ")}: ${g.key}`).join(" · "))
    if (this.callBtn.label) setText(this.callBtn.label, v.callDoctorLabel)
    setControl(this.callBtn, v.visible)
    setText(this.callNotice, callDoctorPressed ? v.callDoctorNotice : "")
  }
}
