// VitaLens core ring (plan Task 7; design §5 A look at Ø 10 cm, §14). Passive view.
// Owns: phase ticks, the progress arc with its W1 glow, the boot power-up, the ward
// radar (4 blips by bearing from the head's yaw, rim ticks for beds out of frame)
// and the centre label. Inputs: material (vertexBaseColorMaterial), the camera and
// the four bed roots. It must not change state or start progress on its own: arcs
// move only when render() receives new selector output. Display only, not a target.
import type {selectRing} from "./Core/EncounterSelectors"
import {dim, HudMesh} from "./VitaLensHudMesh"
import {applyTextRole, COLOR, makeText, obj, setText, toneColor} from "./VitaLensSharedUI"

type RingView = ReturnType<typeof selectRing>

const R_OUT = 5.0
/** Half-width of the binocular frame in degrees (53 cm at 110 cm). */
const FRAME_HALF_DEG = 13.5

@component
export class VitaLensRingUI extends BaseScriptComponent {
  @input
  @hint("Unlit vertex-colour material (SimpleVertexBaseColor package)")
  material!: Material

  @input
  @hint("Camera Object, for radar bearings")
  cameraObject!: SceneObject

  @input
  @hint("Bed 1 root")
  bed1!: SceneObject

  @input
  @hint("Bed 2 root")
  bed2!: SceneObject

  @input
  @hint("Bed 3 root")
  bed3!: SceneObject

  @input
  @hint("Bed 4 root")
  bed4!: SceneObject

  @input
  @hint("Boot power-up duration in seconds (decorative, once per boot)")
  @widget(new SliderWidget(0.3, 3, 0.1))
  powerUpSeconds: number = 1.2

  @input
  @hint("Arc sweep duration in seconds when real progress changes")
  @widget(new SliderWidget(0.1, 1, 0.05))
  sweepSeconds: number = 0.3

  private mesh!: HudMesh
  private label!: Text
  private view: RingView | null = null
  private shown = 0
  private target = 0
  private sweepFrom = 0
  private sweepT = 1
  private powerT = 1
  private lastMode = ""
  private lastBearings = ""
  private selected = -1

  onAwake(): void {
    this.mesh = new HudMesh(obj(this.sceneObject, "RingMesh"), this.material)
    const host = obj(this.sceneObject, "RingLabel", new vec3(0, 0, 0.2))
    this.label = makeText(host, "", "Label", 6, 2, {align: "center"})
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** selectedBed: 0-based index of the chosen bed (Bed 1 = 0), or -1. */
  render(v: RingView, selectedBed: number): void {
    this.selected = selectedBed
    const target = v.progress ? v.progress.done / Math.max(1, v.progress.total) : 0
    if (v.mode === "powerUp" && this.lastMode !== "powerUp") this.powerT = 0
    if (Math.abs(target - this.target) > 1e-6) {
      this.sweepFrom = this.shown
      this.target = target
      this.sweepT = 0
    }
    this.lastMode = v.mode
    this.view = v
    applyTextRole(this.label, v.label.length <= 5 ? "Body" : "Label")
    setText(this.label, v.label, toneColor(v.tone, COLOR.inkSoft))
    this.draw()
  }

  private tick(): void {
    if (!this.view) return
    const dt = getDeltaTime()
    let dirty = false
    if (this.powerT < 1) {
      this.powerT = Math.min(1, this.powerT + dt / Math.max(0.01, this.powerUpSeconds))
      dirty = true
    }
    if (this.sweepT < 1) {
      this.sweepT = Math.min(1, this.sweepT + dt / Math.max(0.01, this.sweepSeconds))
      this.shown = this.sweepFrom + (this.target - this.sweepFrom) * (1 - Math.pow(1 - this.sweepT, 3))
      dirty = true
    }
    if (this.view.mode === "radar") {
      const key = this.bearings()
        .map((b) => Math.round(b.deg))
        .join(",")
      if (key !== this.lastBearings) {
        this.lastBearings = key
        dirty = true
      }
    }
    if (dirty) this.draw()
  }

  /** Bearing of each bed from the head's yaw, degrees, positive to the right. */
  private bearings(): {deg: number; near: boolean}[] {
    if (!this.cameraObject) return []
    const cam = this.cameraObject.getTransform()
    const p = cam.getWorldPosition()
    const look = cam.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const yaw = Math.atan2(look.x, -look.z)
    const out: {deg: number; near: boolean}[] = []
    for (const bed of [this.bed1, this.bed2, this.bed3, this.bed4]) {
      if (!bed) continue
      const d = bed.getTransform().getWorldPosition().sub(p)
      let deg = ((Math.atan2(d.x, -d.z) - yaw) * 180) / Math.PI
      while (deg > 180) deg -= 360
      while (deg < -180) deg += 360
      out.push({deg, near: Math.sqrt(d.x * d.x + d.z * d.z) < 250})
    }
    return out
  }

  private draw(): void {
    const v = this.view
    if (!v) return
    const m = this.mesh.clear()
    const base = v.mode === "emergency" ? COLOR.emergency : COLOR.core
    const dimmed = v.mode === "dimmed"
    const k = dimmed ? 0.4 : 1
    // Phase ticks: past, current, future. Display only.
    for (let i = 0; i < v.phaseCount; i++) {
      const a = 90 - (i * 360) / v.phaseCount
      const current = i === v.phaseIndex
      const c = dim(base, k * (current ? 1 : i < v.phaseIndex ? 0.55 : 0.22))
      m.bar(Math.cos((a * Math.PI) / 180) * (current ? 4.5 : 4.7), Math.sin((a * Math.PI) / 180) * (current ? 4.5 : 4.7), current ? 1.0 : 0.6, 0.35, a, c)
    }
    // Track: draws in once during the boot power-up (decorative, never shown as progress).
    const ease = 1 - Math.pow(1 - this.powerT, 3)
    m.arc(3.6, 3.85, 90 - 360 * ease, 90, dim(base, k * 0.22))
    // Progress arc with glow (waiver W1), clockwise from the top, real progress only.
    if (v.progress && this.shown > 0.001) {
      const c = toneColor(v.tone, COLOR.core)
      const a0 = 90 - 360 * Math.min(1, this.shown)
      m.arc(3.3, 4.15, a0, 90, dim(c, k * 0.25))
      m.arc(3.5, 3.95, a0, 90, dim(c, k))
    }
    if (v.mode === "radar") {
      this.bearings().forEach((b, i) => {
        const a = ((90 - b.deg) * Math.PI) / 180
        const r = b.near ? 1.4 : 2.5
        const selected = i === this.selected
        m.quad(Math.cos(a) * r, Math.sin(a) * r, selected ? 0.35 : 0.25, selected ? 0.35 : 0.25, selected ? COLOR.ink : COLOR.core)
        if (Math.abs(b.deg) > FRAME_HALF_DEG) {
          m.bar(Math.cos(a) * (R_OUT - 0.2), Math.sin(a) * (R_OUT - 0.2), 0.8, 0.3, (a * 180) / Math.PI, COLOR.core)
        }
      })
    }
    m.commit()
  }
}
