// VitaLens bed flag (plan Task 7; design §2.2, §6 "Bed flags"). Passive view, one
// per bed, placed by Main over the bed's head end (WARD_LAYOUT.flag). Shows "Bed n" and up to 3
// needs from the fictional assignment. Never a name, initials or photo, and never a
// patient identifier: a bed flag does not replace the wristband check.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import type {selectWardFlags} from "./Core/EncounterSelectors"
import {WARD_LAYOUT} from "./Core/WardLayout"
import {applyTextRole, COLOR, isBehindShownPanel, panel, setText, show, text} from "./VitaLensSharedUI"

type WardView = ReturnType<typeof selectWardFlags>

@component
export class VitaLensBedFlagUI extends BaseScriptComponent {
  @input
  @hint("Which bed this flag belongs to (1–4)")
  bedNumber: number = 3

  /** One size for every bed (WARD_LAYOUT.flag); Main places the flag over its bed's head end. */
  private readonly flagSize = new vec2(WARD_LAYOUT.flag.size[0], WARD_LAYOUT.flag.size[1])
  private readonly textEmCm: number = WARD_LAYOUT.flag.textEmCm

  private flag!: SceneObject
  private title!: Text
  private needs!: Text
  private wanted = false

  /** A flag seen through the panel on show would compete with it, so it hides until clear. */
  private updateVisibility(): void {
    const behind = this.wanted && isBehindShownPanel(this.sceneObject.getTransform().getWorldPosition(), this.flagSize.x, this.flagSize.y)
    show(this.flag, this.wanted && !behind)
  }

  onAwake(): void {
    this.createEvent("LateUpdateEvent").bind(() => this.updateVisibility())
    this.sceneObject.createComponent("Component.Canvas")
    this.sceneObject.createComponent(Billboard.getTypeName())
    const w = this.flagSize.x
    const h = this.flagSize.y
    const pad = h * 0.08
    const p = panel(this.sceneObject, "BedFlag", w, h, vec3.zero(), {gap: pad * 0.5, padX: pad, padY: pad})
    this.flag = p.root
    const inner = w - 2 * pad
    const titleH = this.textEmCm * 1.9
    this.title = text(p.column, "Bed " + this.bedNumber, "Title", inner, titleH, {name: "BedFlag" + this.bedNumber + "Title"})
    this.needs = text(p.column, "", "Body", inner, h - 2 * pad - titleH - pad * 0.5, {color: COLOR.caution, name: "BedFlag" + this.bedNumber + "Needs"})
    applyTextRole(this.title, "Title", (this.textEmCm * 1.25) / 1.8)
    applyTextRole(this.needs, "Body", this.textEmCm / 1.3)
  }

  render(v: WardView): void {
    const f = v.flags[this.bedNumber - 1]
    this.wanted = v.flagsVisible && f !== undefined
    this.updateVisibility()
    if (!f) return
    setText(this.title, f.bedLabel + (f.selected ? " · selected" : ""), f.selected ? COLOR.core : COLOR.ink)
    setText(this.needs, f.needs.join("\n"), COLOR.caution)
  }
}
