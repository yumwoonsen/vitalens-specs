// VitalLens menu and privacy plate (plan Tasks 7–8; owner round 2b compact HUD).
// Passive view on the bed-anchored card. The status strip itself now lives in the
// head-locked mini HUD (which also carries the Menu button). This module shows the
// menu (Switch patient, Reset demo, then an explicit Confirm or Cancel) and the
// "Privacy on" plate, each in front of the card. Emits intents only.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import type {selectStatusRail} from "./Core/EncounterSelectors"
import {button, CARD, CARD_BTN_H, cardPanel, COLOR, flexRow, setControl, setText, show, text, UiButton} from "./VitaLensSharedUI"

type RailView = ReturnType<typeof selectStatusRail>

const ICON_CLOSE = requireAsset("../Icons/Storyboard/close.png") as Texture
const ICON_SWITCH = requireAsset("../Icons/swap_horiz.png") as Texture
const ICON_RESET = requireAsset("../Icons/Storyboard/retry.png") as Texture

@component
export class VitaLensRailUI extends BaseScriptComponent {
  private readonly _onSwitch = new Event<void>()
  private readonly _onReset = new Event<void>()
  private readonly _onConfirm = new Event<void>()
  private readonly _onCancel = new Event<void>()
  private readonly _onClose = new Event<void>()
  get onClose(): PublicApi<void> {
    return this._onClose.publicApi()
  }
  get onSwitch(): PublicApi<void> {
    return this._onSwitch.publicApi()
  }
  get onReset(): PublicApi<void> {
    return this._onReset.publicApi()
  }
  get onConfirm(): PublicApi<void> {
    return this._onConfirm.publicApi()
  }
  get onCancel(): PublicApi<void> {
    return this._onCancel.publicApi()
  }

  private menuMain!: SceneObject
  private menuConfirm!: SceneObject
  private switchBtn!: UiButton
  private resetBtn!: UiButton
  private confirmBtn!: UiButton
  private cancelBtn!: UiButton
  private pending!: Text
  private clears!: Text
  private privacyPlate!: SceneObject
  private privacyText!: Text

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const w = CARD.inner
    const h = CARD_BTN_H
    // Overlays sit 1.5 cm in front of the card.
    const main = cardPanel(this.sceneObject, "MenuMain", 24, {gap: 0.8})
    this.menuMain = main.root
    main.root.getTransform().setLocalPosition(main.root.getTransform().getLocalPosition().add(new vec3(0, 0, 1.5)))
    text(main.column, "Menu", "Title", w, 2.4)
    text(main.column, "Demo controls. Each asks you to confirm.", "Label", w, 1.6, {color: COLOR.inkSoft})
    this.switchBtn = button(main.column, "BtnMenuSwitch", "Switch patient", w, h, () => this._onSwitch.invoke(), {icon: ICON_SWITCH})
    this.resetBtn = button(main.column, "BtnMenuReset", "Reset demo", w, h, () => this._onReset.invoke(), {icon: ICON_RESET})
    // The panel covers the screens' Menu button, so it closes itself.
    button(main.column, "BtnMenuClose", "Close", w, h, () => this._onClose.invoke(), {icon: ICON_CLOSE})

    const confirm = cardPanel(this.sceneObject, "MenuConfirm", 26, {gap: 0.8})
    this.menuConfirm = confirm.root
    confirm.root.getTransform().setLocalPosition(confirm.root.getTransform().getLocalPosition().add(new vec3(0, 0, 1.5)))
    this.pending = text(confirm.column, "", "Body", w, 2.4, {name: "MenuPending"})
    this.clears = text(confirm.column, "", "Label", w, 12, {color: COLOR.inkSoft, name: "MenuClears"})
    const actions = flexRow(confirm.column, w, h, {gap: 0.6})
    this.confirmBtn = button(actions, "BtnMenuConfirm", "Confirm", (w - 0.6) / 2, h, () => this._onConfirm.invoke(), {style: "Primary"})
    this.cancelBtn = button(actions, "BtnMenuCancel", "Cancel", (w - 0.6) / 2, h, () => this._onCancel.invoke())

    const priv = cardPanel(this.sceneObject, "PrivacyPlate", 12, {gap: 0.6})
    this.privacyPlate = priv.root
    priv.root.getTransform().setLocalPosition(priv.root.getTransform().getLocalPosition().add(new vec3(0, 0, 1.5)))
    text(priv.column, "Privacy on", "Title", w, 2.4, {name: "PrivacyTitle"})
    this.privacyText = text(priv.column, "", "Label", w, 5, {color: COLOR.inkSoft, name: "PrivacyMessage"})
  }

  render(v: RailView): void {
    const m = v.menu
    show(this.menuMain, m.open && m.pending === "none")
    show(this.menuConfirm, m.open && m.pending !== "none")
    setControl(this.switchBtn, m.switchPatient.enabled)
    setControl(this.resetBtn, m.resetDemo.enabled)
    setControl(this.confirmBtn, m.confirm.enabled)
    setControl(this.cancelBtn, m.cancel.enabled)
    setText(this.pending, m.pendingMessage ?? "")
    setText(this.clears, m.clears.map((c) => "· " + c).join("\n"))
    show(this.privacyPlate, v.privacyOn && !m.open)
    setText(
      this.privacyText,
      (v.captureInterrupted ? "Capture stopped. It does not restart on its own.\n" : "") +
        "Patient details hidden. Select End privacy to continue.",
    )
  }
}
