// VitalLens draft review (plan Task 8; owner round 2: the glasses never sign or
// file). Passive view on the bed-anchored card: the draft (simulated AI) with its
// seeded flag, the pick-list correction (replaces the draft on the same card while
// open), Reject, Start a new capture, Amend, and "Save for COW review", the only
// control that changes the draft to "Draft saved, pending review on COW".
// Emits intents only; Main owns the state.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import type {FlagId} from "./Core/EncounterTypes"
import type {selectDraft} from "./Core/EncounterSelectors"
import {button, CARD, CARD_BTN_H, cardPanel, COLOR, flexRow, setControl, setText, show, text, UiButton} from "./VitaLensSharedUI"

type DraftView = ReturnType<typeof selectDraft>

/** Pick-list slots; the fixture offers 4 options or fewer. */
const MAX_OPTIONS = 3

@component
export class VitaLensReviewUI extends BaseScriptComponent {
  private readonly _onOpenFlag = new Event<FlagId>()
  private readonly _onChoose = new Event<{flagId: FlagId; optionId: string}>()
  private readonly _onCloseFlag = new Event<void>()
  private readonly _onReject = new Event<void>()
  private readonly _onNewCapture = new Event<void>()
  private readonly _onAmend = new Event<void>()
  private readonly _onSave = new Event<void>()
  get onOpenFlag(): PublicApi<FlagId> {
    return this._onOpenFlag.publicApi()
  }
  get onChoose(): PublicApi<{flagId: FlagId; optionId: string}> {
    return this._onChoose.publicApi()
  }
  get onCloseFlag(): PublicApi<void> {
    return this._onCloseFlag.publicApi()
  }
  get onReject(): PublicApi<void> {
    return this._onReject.publicApi()
  }
  get onNewCapture(): PublicApi<void> {
    return this._onNewCapture.publicApi()
  }
  get onAmend(): PublicApi<void> {
    return this._onAmend.publicApi()
  }
  get onSave(): PublicApi<void> {
    return this._onSave.publicApi()
  }

  private draftCard!: SceneObject
  private draftTitle!: Text
  private draftStatus!: Text
  private draftLines!: Text
  private flagBtn!: UiButton
  private saveBtn!: UiButton
  private rejectBtn!: UiButton
  private newCaptureBtn!: UiButton
  private amendBtn!: UiButton
  private draftMessage!: Text
  private pickList!: SceneObject
  private pickTitle!: Text
  private pickEvidence!: Text
  private optionBtns: UiButton[] = []
  private optionIds: (string | null)[] = []
  private pickFlag: FlagId | null = null
  private closePickBtn!: UiButton

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const h = CARD_BTN_H
    const bw = (w - 1.8) / 4
    const d = cardPanel(this.sceneObject, "DraftCard", 30, {gap: 0.5, padY: 0.8})
    this.draftCard = d.root
    this.draftTitle = text(d.column, "", "Title", w, 2.4, {color: COLOR.system, name: "DraftTitle"})
    this.draftStatus = text(d.column, "", "Label", w, 1.6, {name: "DraftStatus"})
    this.draftLines = text(d.column, "", "Body", w, 7.6, {name: "DraftLines"})
    // Non-empty placeholders: button() only creates a label for a non-empty string; render() fills it.
    this.flagBtn = button(d.column, "BtnFlagSite", "Flagged item", w, h, () => this._onOpenFlag.invoke("site"))
    const actions = flexRow(d.column, w, h + 0.6, {gap: 0.6})
    this.saveBtn = button(actions, "BtnSaveForReview", "Save for\nCOW review", bw, h + 0.6, () => this._onSave.invoke(), {style: "Primary"})
    this.rejectBtn = button(actions, "BtnRejectDraft", "Reject\ndraft", bw, h + 0.6, () => this._onReject.invoke())
    this.newCaptureBtn = button(actions, "BtnNewCapture", "New\ncapture", bw, h + 0.6, () => this._onNewCapture.invoke())
    this.amendBtn = button(actions, "BtnAmendNote", "Amend\ndraft", bw, h + 0.6, () => this._onAmend.invoke())
    this.draftMessage = text(d.column, "", "Label", w, 2.4, {color: COLOR.inkSoft, name: "DraftMessage"})

    const p = cardPanel(this.sceneObject, "PickList", 30, {gap: 0.6, padY: 0.8})
    this.pickList = p.root
    this.pickTitle = text(p.column, "", "Title", w, 2.4, {name: "PickTitle"})
    this.pickEvidence = text(p.column, "", "Label", w, 2.4, {color: COLOR.inkSoft, name: "PickEvidence"})
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const slot = i
      this.optionIds.push(null)
      this.optionBtns.push(
        button(p.column, "BtnPickOption" + i, "Option", w, h, () => {
          const id = this.optionIds[slot]
          if (id !== null && this.pickFlag !== null) this._onChoose.invoke({flagId: this.pickFlag, optionId: id})
        }),
      )
    }
    this.closePickBtn = button(p.column, "BtnClosePick", "Close pick list", w, h, () => this._onCloseFlag.invoke())
  }

  render(d: DraftView): void {
    const pick = d.visible ? d.pickList : null
    show(this.draftCard, d.visible && pick === null)
    setText(this.draftTitle, d.version !== null ? `${d.label} · v${d.version}` : d.label)
    const statusColor = d.saved ? COLOR.verified : d.status === "rejected" ? COLOR.caution : COLOR.ink
    setText(this.draftStatus, d.statusLabel ?? d.emptyMessage ?? "", statusColor)
    setText(this.draftLines, d.exists ? d.lines.join("\n") : "Capture a sample in Routine round, then draft the note.")

    const flag = d.flags[0]
    show(this.flagBtn.button.sceneObject, flag !== undefined)
    if (flag) {
      setControl(this.flagBtn, flag.open.enabled)
      // The seeded error stays amber until resolved, even while the button is locked.
      const label = flag.resolved ? `${flag.label}: ${flag.resolutionLabel}` : `Check: ${flag.label}`
      if (this.flagBtn.label) setText(this.flagBtn.label, label, flag.resolved ? COLOR.verified : COLOR.caution)
    }
    setControl(this.saveBtn, d.save.enabled)
    setControl(this.rejectBtn, d.reject.enabled)
    setControl(this.newCaptureBtn, d.newCapture.enabled)
    setControl(this.amendBtn, d.amend.enabled)
    const history = d.history.map((x) => `v${x.version} ${x.statusLabel.toLowerCase()}`).join(", ")
    const hint = d.saved
      ? "Review and sign on the COW. Nothing is filed from the glasses."
      : d.save.reason && d.exists
        ? d.save.reason
        : history
          ? "Earlier: " + history
          : ""
    setText(this.draftMessage, hint, d.saved ? COLOR.inkSoft : COLOR.caution)

    show(this.pickList, pick !== null)
    this.pickFlag = pick ? pick.flagId : null
    if (pick) {
      setText(this.pickTitle, pick.title)
      setText(this.pickEvidence, flag ? flag.evidence : "")
      setControl(this.closePickBtn, pick.close.enabled)
    }
    this.optionBtns.forEach((b, i) => {
      const o = pick ? pick.options[i] : undefined
      this.optionIds[i] = o ? o.id : null
      show(b.button.sceneObject, o !== undefined)
      if (o && b.label) setText(b.label, o.label)
      setControl(b, o !== undefined && o.choose.enabled)
    })
  }
}
