// VitalLens Boot and Clock-in cards (plan Tasks 7–8; owner round 2b compact HUD).
// Passive view on the bed-anchored card. Boot carries the one overall "Simulated"
// disclosure and "Begin demonstration"; Clock in starts the demo session.
// Emits intents only; Main owns the state.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {button, CARD, cardPanel, COLOR, setControl, show, text, UiButton} from "./VitaLensSharedUI"

export interface BootView {
  readonly disclosureVisible: boolean
  readonly clockInVisible: boolean
  readonly begin: boolean
  readonly clockIn: boolean
  readonly demoSessionLabel: string
}

const DISCLOSURE =
  "Simulated. Every patient, record and value here is fictional. " +
  "Wristband scan, dictation, AI drafting, vitals and handover are simulated. " +
  "No camera, record system or other service is connected. Not for clinical use."

@component
export class VitaLensBootUI extends BaseScriptComponent {
  // The disclosure is a fixed safety label (AC11), so it is not an Inspector input.
  private readonly disclosure: string = DISCLOSURE

  private readonly _onBegin = new Event<void>()
  private readonly _onClockIn = new Event<void>()
  get onBegin(): PublicApi<void> {
    return this._onBegin.publicApi()
  }
  get onClockIn(): PublicApi<void> {
    return this._onClockIn.publicApi()
  }

  private bootWindow!: SceneObject
  private clockWindow!: SceneObject
  private beginBtn!: UiButton
  private clockBtn!: UiButton
  private sessionText!: Text

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const boot = cardPanel(this.sceneObject, "BootWindow", 24, {gap: 0.8})
    this.bootWindow = boot.root
    text(boot.column, "VitalLens", "Title", w, 2.6, {color: COLOR.core})
    text(boot.column, "Bedside nursing walkthrough (demonstration)", "Label", w, 1.6, {color: COLOR.inkSoft})
    text(boot.column, this.disclosure, "Label", w, 7.4, {color: COLOR.system, name: "BootDisclosure"})
    this.beginBtn = button(boot.column, "BtnBeginDemo", "Begin demonstration", w, 6, () => this._onBegin.invoke(), {style: "Primary", role: "Body"})

    const clock = cardPanel(this.sceneObject, "ClockInWindow", 17, {gap: 0.8})
    this.clockWindow = clock.root
    text(clock.column, "Clock in", "Title", w, 2.4)
    text(clock.column, "Start the demo shift: 4 assigned beds, fictional patients.", "Label", w, 1.6)
    this.sessionText = text(clock.column, "", "Label", w, 1.6, {color: COLOR.system})
    this.clockBtn = button(clock.column, "BtnClockIn", "Clock in (demo session)", w, 6, () => this._onClockIn.invoke(), {style: "Primary", role: "Body"})
  }

  render(v: BootView): void {
    show(this.bootWindow, v.disclosureVisible)
    show(this.clockWindow, v.clockInVisible)
    setControl(this.beginBtn, v.begin)
    setControl(this.clockBtn, v.clockIn)
    this.sessionText.text = v.demoSessionLabel
  }
}
