// VitalLens wristband bracket and identity chip (plan Task 7; design §2.2, §6,
// waiver W2). Passive view on the virtual wristband stand-in. The bracket closes
// only when the patient is verified with both identifiers; mismatch turns it red.
// The chip shows the verification state, then name, age, bed and "2 identifiers".
// No face, photo or initials-from-camera: everything comes from selectIdentity.
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import type {selectIdentity} from "./Core/EncounterSelectors"
import {dim, HudMesh} from "./VitaLensHudMesh"
import type {WristStage} from "./VitaLensScreenUI"
import {box, Box, cm, hex, label, obj, setBorder, setText, setWeight, show} from "./VitaLensSharedUI"

type IdentityView = ReturnType<typeof selectIdentity>

// Chip from the spec (wristband_chip): 16 × 5 cm pill at UI_SCALE, 9 cm above the wrist.
const CHIP_W = cm(16)
const CHIP_H = cm(5)
const CHIP_ABOVE = 9
const CHIP_FILL = hex("#171B20", 0.72)
const SCAN_INK = hex("#CCFBF1", 0.6)
const CONFIRM_INK = hex("#5EEAD4")
const VERIFIED_INK = hex("#34D399")
const MISMATCH_FILL = hex("#B91C1C")
const WHITE = hex("#FFFFFF")

@component
export class VitaLensWristUI extends BaseScriptComponent {
  @input
  @hint("Unlit vertex-colour material for the bracket")
  material!: Material

  @input
  @hint("Bracket size in cm (design: 12 × 6)")
  bracketSize: vec2 = new vec2(12, 6)

  private bracket!: HudMesh
  private bracketRoot!: SceneObject
  private chip!: SceneObject
  private chipFill!: Box
  private chipText!: Text
  private lastKey = ""

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    this.bracketRoot = global.scene.createSceneObject("WristBracket")
    this.bracketRoot.setParent(this.sceneObject)
    this.bracket = new HudMesh(this.bracketRoot, this.material)
    this.chip = obj(this.sceneObject, "WristChip", new vec3(-CHIP_W / 2, CHIP_ABOVE + CHIP_H / 2, 0))
    this.chipFill = box(this.chip, 0, 0, CHIP_W, CHIP_H, CHIP_FILL, CHIP_H / 2, {w: 0.08, c: CONFIRM_INK})
    this.chipText = label(this.chip, 0, 0, CHIP_W, CHIP_H, "", 1.6, 400, CONFIRM_INK, {align: "center", name: "WristChipLine1"})
  }

  /** `stage` is null when no wristband screen shows. */
  render(v: IdentityView, stage: WristStage | null): void {
    const visible = stage !== null
    show(this.bracketRoot, visible)
    // During the scan step the pointer bubble says what to do, so the chip would only crowd it.
    show(this.chip, visible && stage !== "scan")
    if (!stage) return
    const verified = stage === "verified"
    const bad = stage === "mismatch"
    const ink = bad ? WHITE : verified ? VERIFIED_INK : stage === "scan" ? SCAN_INK : CONFIRM_INK
    const line = stage === "scan" ? "Scan" : bad ? "Mismatch" : verified ? v.chip.text.split(" ")[0] + " verified" : "Not confirmed"
    setText(this.chipText, line, ink)
    setWeight(this.chipText, bad ? 700 : 400)
    this.chipFill.rr.backgroundColor = bad ? MISMATCH_FILL : CHIP_FILL
    setBorder(this.chipFill.rr, {w: 0.08, c: bad ? MISMATCH_FILL : ink})
    if (stage === this.lastKey) return
    this.lastKey = stage
    const w = verified ? this.bracketSize.x - 2 : this.bracketSize.x
    const h = verified ? this.bracketSize.y - 1 : this.bracketSize.y
    const c = bad ? MISMATCH_FILL : verified ? VERIFIED_INK : stage === "scan" ? dim(CONFIRM_INK, 0.6) : CONFIRM_INK
    this.bracket.clear().brackets(w, h, 2, 0.4, c).brackets(w + 0.6, h + 0.6, 2.4, 0.4, dim(c, 0.25)).commit()
  }
}
