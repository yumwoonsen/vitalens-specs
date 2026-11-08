// VitalLens dock (plan Tasks 7–8; owner round 2b: the bed card's footer). Passive
// view. Five 4.5 cm round UI Kit buttons, 2 cm apart: Back, Privacy, Minimise,
// Emergency, Next, each with a caption below. A disabled control is inactive and
// dimmed; its reason is shown by the window that owns the task. Next and Back
// never approve, file or verify anything: they only emit NAV events.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexAlign} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import type {selectDock} from "./Core/EncounterSelectors"
import {button, COLOR, flexColumn, flexRow, setControl, setText, text, UiButton} from "./VitaLensSharedUI"

type DockView = ReturnType<typeof selectDock>
export type DockAction = "back" | "privacy" | "minimise" | "emergency" | "next"

const ICONS: {readonly [K in DockAction]: Texture} = {
  back: requireAsset("../Icons/Storyboard/back.png") as Texture,
  privacy: requireAsset("../Icons/Storyboard/eyeoff.png") as Texture,
  minimise: requireAsset("../Icons/Storyboard/mini.png") as Texture,
  emergency: requireAsset("../Icons/Storyboard/emerg.png") as Texture,
  next: requireAsset("../Icons/Storyboard/next.png") as Texture,
}
const NAMES: {readonly [K in DockAction]: string} = {
  back: "BtnBack",
  privacy: "BtnPrivacy",
  minimise: "BtnMinimise",
  emergency: "BtnEmergency",
  next: "BtnNext",
}
const ORDER: readonly DockAction[] = ["back", "privacy", "minimise", "emergency", "next"]

@component
export class VitaLensDockUI extends BaseScriptComponent {
  @input
  @hint("Dock button diameter in cm (round 2b card footer: 4.5, minimum 4)")
  buttonSize: number = 4.5

  @input
  @hint("Gap between dock buttons in cm (design: 2)")
  gap: number = 2

  private readonly _onAction = new Event<DockAction>()
  get onAction(): PublicApi<DockAction> {
    return this._onAction.publicApi()
  }

  private buttons: {[K in DockAction]?: UiButton} = {}
  private captions: {[K in DockAction]?: Text} = {}

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const s = this.buttonSize
    const w = ORDER.length * s + (ORDER.length - 1) * this.gap
    const row = flexRow(this.sceneObject, w, s + 2, {gap: this.gap, align: FlexAlign.Start})
    for (const a of ORDER) {
      const slot = flexColumn(row, s, s + 2, {gap: 0.3, align: FlexAlign.Center})
      this.buttons[a] = button(slot, NAMES[a], "", s, s, () => this._onAction.invoke(a), {round: true, icon: ICONS[a]})
      this.captions[a] = text(slot, "", "Label", s + 1.8, 1.4, {align: "center", name: NAMES[a] + "Caption"})
    }
  }

  render(v: DockView): void {
    for (const a of ORDER) {
      const c = v[a]
      setControl(this.buttons[a] as UiButton, c.enabled)
      const color = !c.enabled ? COLOR.disabled : a === "emergency" ? COLOR.emergencyInk : COLOR.inkSoft
      setText(this.captions[a] as Text, c.label, color)
    }
  }
}
