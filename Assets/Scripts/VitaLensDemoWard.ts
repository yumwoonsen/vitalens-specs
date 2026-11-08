// VitalLens demo ward for the Lens Studio preview: one bed and its fictional patient, ported
// from bed() and col{} in the storyboard's drawWorld. World cm, eye at the origin, -Z ahead.
// Like the storyboard it paints flat colours back to front, without depth, so the arm and
// band draw over the blanket and the wrist stays at the point the brackets frame.
import {WARD_LAYOUT} from "./Core/WardLayout"

/** Preview only: real glasses see the real ward, so this must be false for device builds. */
export const SHOW_DEMO_WARD = false

const BED_CENTRE: readonly [number, number, number] = [0, -95, -165]

// The storyboard's wrist gaze, in degrees. The preview writes its own camera pose back every
// frame, so the ward turns the opposite way about the eye: a level camera at the origin then
// sees what the gaze sees.
const GAZE_YAW = 4.6
const GAZE_PITCH = -21.1
const GAZE_TURN = quat.angleAxis((-GAZE_YAW * Math.PI) / 180, vec3.up()).multiply(quat.angleAxis((GAZE_PITCH * Math.PI) / 180, vec3.right())).invert()

const FRAME = rgb("#2f3436")
const MATT = rgb("#8d9696")
const MATT_FRONT = rgb("#737c7c")
const BLANKET = rgb("#56727d")
const BLANKET_FRONT = rgb("#47606a")
const PILLOW = rgb("#a3abab")
const SKIN = rgb("#7a6b61")
const BAND = rgb("#d9e2e4")

function rgb(hex: string): vec4 {
  const n = parseInt(hex.slice(1), 16)
  return new vec4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1)
}

const RING_STEPS = 20
const CAP_STEPS = 6
const NORMAL = new vec3(0, 0, 1)

class WardMesh {
  private readonly verts: number[] = []
  private readonly indices: number[] = []
  private count = 0

  private vertex(p: vec3, c: vec4): number {
    this.verts.push(p.x, p.y, p.z, NORMAL.x, NORMAL.y, NORMAL.z, c.x, c.y, c.z, 1)
    return this.count++
  }

  private quad(a: vec3, b: vec3, d: vec3, e: vec3, c: vec4): void {
    const first = this.count
    for (const p of [a, b, d, e]) this.vertex(p, c)
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  /** The storyboard's box(): the faces the eye can see, in its order. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: vec4, front: vec4, side: vec4): void {
    const p = (x: number, y: number, z: number): vec3 => new vec3(x, y, z)
    if (x0 > 0) this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), side)
    if (x1 < 0) this.quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), side)
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), front)
    this.quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), top)
  }

  /** Rounded ends when `caps` is set, flat when not. `stretchY` is the storyboard's taller head. */
  private tube(a: vec3, b: vec3, r: number, c: vec4, caps: boolean, stretchY = 1): void {
    const span = b.sub(a)
    const axis = span.length > 0.001 ? span.normalize() : new vec3(1, 0, 0)
    const u = (Math.abs(axis.y) < 0.9 ? new vec3(0, 1, 0) : new vec3(1, 0, 0)).cross(axis).normalize()
    const w = axis.cross(u)
    const rings: {at: vec3; radius: number}[] = []
    if (caps) for (let i = 0; i < CAP_STEPS; i++) {
      const t = (Math.PI / 2) * (i / CAP_STEPS)
      rings.push({at: a.sub(axis.uniformScale(r * Math.cos(t))), radius: r * Math.sin(t)})
    }
    rings.push({at: a, radius: r})
    rings.push({at: b, radius: r})
    if (caps) for (let i = 1; i <= CAP_STEPS; i++) {
      const t = (Math.PI / 2) * (i / CAP_STEPS)
      rings.push({at: b.add(axis.uniformScale(r * Math.sin(t))), radius: r * Math.cos(t)})
    }
    const first = this.count
    for (const ring of rings) {
      for (let s = 0; s < RING_STEPS; s++) {
        const angle = (2 * Math.PI * s) / RING_STEPS
        const p = ring.at.add(u.uniformScale(Math.cos(angle) * ring.radius)).add(w.uniformScale(Math.sin(angle) * ring.radius))
        this.vertex(new vec3(p.x, a.y + (p.y - a.y) * stretchY, p.z), c)
      }
    }
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let s = 0; s < RING_STEPS; s++) {
        const p = first + i * RING_STEPS + s
        const q = first + i * RING_STEPS + (s + 1) % RING_STEPS
        this.indices.push(p, q, q + RING_STEPS, p, q + RING_STEPS, p + RING_STEPS)
      }
    }
    if (!caps) {
      for (const [ring, centre] of [[0, a], [rings.length - 1, b]] as const) {
        const hub = this.vertex(centre, c)
        const base = first + ring * RING_STEPS
        for (let s = 0; s < RING_STEPS; s++) this.indices.push(hub, base + s, base + (s + 1) % RING_STEPS)
      }
    }
  }

  capsule(a: vec3, b: vec3, r: number, c: vec4): void {
    this.tube(a, b, r, c, true)
  }

  head(at: vec3, r: number, c: vec4): void {
    this.tube(at, at, r, c, true, 1.15)
  }

  band(a: vec3, b: vec3, r: number, c: vec4): void {
    this.tube(a, b, r, c, false)
  }

  commit(host: SceneObject, material: Material): void {
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "color", components: 4},
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    builder.appendVerticesInterleaved(this.verts)
    builder.appendIndices(this.indices)
    builder.updateMesh()
    const rmv = host.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = builder.getMesh()
    rmv.mainMaterial = material
    // Before the panels and brackets, which draw over it.
    rmv.setRenderOrder(-10)
  }
}

function buildBed(m: WardMesh): void {
  const [bx, , bz] = BED_CENTRE
  m.box(bx - 104, bx - 100, -125, -55, bz - 45, bz + 45, FRAME, FRAME, FRAME)
  m.box(bx - 100, bx + 100, -125, -110, bz - 45, bz + 45, FRAME, FRAME, FRAME)
  m.box(bx - 100, bx + 100, -110, -95, bz - 45, bz + 45, MATT, MATT_FRONT, MATT_FRONT)
  m.box(bx - 96, bx - 66, -95, -89, bz - 30, bz + 30, PILLOW, PILLOW, PILLOW)
  m.box(bx - 64, bx + 96, -95, -84, bz - 42, bz + 42, BLANKET, BLANKET_FRONT, BLANKET_FRONT)
  // The storyboard has no torso: this one rises from the blanket, in its colour.
  m.capsule(new vec3(bx - 58, -88, bz), new vec3(bx + 20, -88, bz), 9, BLANKET)
  m.head(new vec3(bx - 80, -83, bz), 10, SKIN)
  const [wx, wy, wz] = WARD_LAYOUT.wrist
  const wrist = new vec3(bx + wx, BED_CENTRE[1] + wy, bz + wz)
  m.capsule(new vec3(bx - 40, -86, bz + 36), new vec3(bx + 4, -87, bz + 41), 3.5, SKIN)
  m.band(wrist.add(new vec3(-2, 0, 0)), wrist.add(new vec3(2, 0, 0)), 4.25, BAND)
}

export function buildDemoWard(parent: SceneObject, bracketMaterial: Material): void {
  const root = global.scene.createSceneObject("Demo Ward")
  root.setParent(parent)
  root.layer = parent.layer
  root.getTransform().setWorldPosition(vec3.zero())
  root.getTransform().setWorldRotation(GAZE_TURN)
  const material = bracketMaterial.clone()
  material.mainPass.blendMode = BlendMode.Disabled
  material.mainPass.depthTest = false
  material.mainPass.depthWrite = false
  material.mainPass.twoSided = true
  const mesh = new WardMesh()
  buildBed(mesh)
  mesh.commit(root, material)
}

/** Where Bed 2's anchor goes so that anchor + WARD_LAYOUT.wrist lands on the turned wristband. */
export function demoBedAnchor(): vec3 {
  const offset = new vec3(...WARD_LAYOUT.wrist)
  return GAZE_TURN.multiplyVec3(new vec3(...BED_CENTRE).add(offset)).sub(offset)
}
