// VitalLens handover (plan Task 9). Passive view on the bed-anchored card: the ISBAR
// summary built from the saved note and the record, each line with its source; the
// pending tasks with their owners (no control marks a task done); Build or Rebuild;
// and a separate approval slider. Only a completed slide emits approval; a partial
// slide, Next or a timer emits nothing. A stale handover says so and cannot be
// approved until rebuilt. Emits intents only; Main owns the state.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import type {selectHandover} from "./Core/EncounterSelectors"
import {approvalSlider, button, CARD, CARD_BTN_H, cardPanel, COLOR, flexRow, setControl, setInactive, setText, show, text, UiButton} from "./VitaLensSharedUI"

type HandoverView = ReturnType<typeof selectHandover>

const SECTION_LETTER: {readonly [K in HandoverView["lines"][number]["section"]]: string} = {
  Identify: "I",
  Situation: "S",
  Background: "B",
  Assessment: "A",
  Recommendation: "R",
}

@component
export class VitaLensHandoverUI extends BaseScriptComponent {
  private readonly _onBuild = new Event<void>()
  private readonly _onApprove = new Event<void>()
  get onBuild(): PublicApi<void> {
    return this._onBuild.publicApi()
  }
  get onApprove(): PublicApi<void> {
    return this._onApprove.publicApi()
  }

  private card!: SceneObject
  private title!: Text
  private status!: Text
  private lines!: Text
  private tasks!: Text
  private buildBtn!: UiButton
  private slider!: Slider

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const h = CARD_BTN_H
    const p = cardPanel(this.sceneObject, "HandoverCard", 30, {gap: 0.5, padY: 0.8})
    this.card = p.root
    this.title = text(p.column, "", "Title", w, 2.4, {color: COLOR.system, name: "HandoverTitle"})
    this.status = text(p.column, "", "Label", w, 1.6, {name: "HandoverStatus"})
    this.lines = text(p.column, "", "Label", w, 12.4, {name: "HandoverLines"})
    this.tasks = text(p.column, "", "Label", w, 3.6, {color: COLOR.inkSoft, name: "HandoverTasks"})
    const row = flexRow(p.column, w, h, {gap: 1})
    const bw = 9
    this.buildBtn = button(row, "BtnBuildHandover", "Build handover", bw, h, () => this._onBuild.invoke())
    // The approval slider shares its row only with Build, never with a navigation control.
    this.slider = approvalSlider(row, "SliderApproveHandover", w - bw - 1, h, () => this._onApprove.invoke())
  }

  render(v: HandoverView): void {
    show(this.card, v.visible)
    setText(this.title, v.sourceVersion !== null ? `${v.label} · from note v${v.sourceVersion}` : v.label)
    const statusColor = v.status === "stale" ? COLOR.caution : v.status === "approved" ? COLOR.verified : COLOR.ink
    const reason = !v.build.enabled && v.status === "none" && v.build.reason ? v.build.reason + ". " : ""
    setText(this.status, reason + v.message, statusColor)
    setText(
      this.lines,
      v.lines.length > 0
        ? v.lines.map((l) => `${SECTION_LETTER[l.section]}  ${l.text} (${l.source})`).join("\n")
        : "Save a draft for COW review, then build the handover here.",
      v.status === "stale" ? COLOR.inkSoft : COLOR.ink,
    )
    setText(this.tasks, v.tasks.map((t) => `${t.status}: ${t.text}. Owner: ${t.owner}`).join("\n"))
    if (this.buildBtn.label) setText(this.buildBtn.label, v.build.label.replace(" (simulated)", ""))
    setControl(this.buildBtn, v.build.enabled)
    setInactive(this.slider, !v.approve.enabled)
  }
}
