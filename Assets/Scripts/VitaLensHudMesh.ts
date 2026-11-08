// VitaLens HUD geometry (plan Task 7, /mesh-builder-scripting). Flat, display-only
// meshes in the local XY plane facing +Z: ring arcs, ticks, radar blips, the phase
// strip and the wristband bracket. Unlit vertex colour (vertexBaseColorMaterial).
// Dim colour stands in for transparency, because the display is additive.
// Owns no state and takes no input; callers rebuild it when their view changes.

export type Rgba = vec4

export class HudMesh {
  private readonly builder: MeshBuilder
  private verts: number[] = []
  private indices: number[] = []
  private count = 0

  constructor(host: SceneObject, material: Material) {
    this.builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "color", components: 4},
    ])
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
    const rmv = host.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.builder.getMesh()
    rmv.mainMaterial = material
  }

  clear(): HudMesh {
    this.verts = []
    this.indices = []
    this.count = 0
    return this
  }

  private vertex(x: number, y: number, c: Rgba): number {
    this.verts.push(x, y, 0, 0, 0, 1, c.x, c.y, c.z, c.w)
    return this.count++
  }

  /** Ring sector from a0 to a1 degrees (0 = +X, counter-clockwise), CCW winding from +Z. */
  arc(rIn: number, rOut: number, a0: number, a1: number, c: Rgba): HudMesh {
    if (a1 <= a0) return this
    const steps = Math.max(2, Math.ceil((a1 - a0) / 6))
    let prevIn = -1
    let prevOut = -1
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180
      const vin = this.vertex(Math.cos(a) * rIn, Math.sin(a) * rIn, c)
      const vout = this.vertex(Math.cos(a) * rOut, Math.sin(a) * rOut, c)
      if (i > 0) this.indices.push(prevIn, prevOut, vout, prevIn, vout, vin)
      prevIn = vin
      prevOut = vout
    }
    return this
  }

  /** Axis-aligned rectangle centred at (cx, cy). */
  quad(cx: number, cy: number, hw: number, hh: number, c: Rgba): HudMesh {
    const a = this.vertex(cx - hw, cy - hh, c)
    const b = this.vertex(cx + hw, cy - hh, c)
    const d = this.vertex(cx + hw, cy + hh, c)
    const e = this.vertex(cx - hw, cy + hh, c)
    this.indices.push(a, b, d, a, d, e)
    return this
  }

  /** Rectangle of length `len` and width `w` centred at (cx, cy), rotated by `deg`. */
  bar(cx: number, cy: number, len: number, w: number, deg: number, c: Rgba): HudMesh {
    const r = (deg * Math.PI) / 180
    const ux = Math.cos(r) * (len / 2)
    const uy = Math.sin(r) * (len / 2)
    const vx = -Math.sin(r) * (w / 2)
    const vy = Math.cos(r) * (w / 2)
    const a = this.vertex(cx - ux - vx, cy - uy - vy, c)
    const b = this.vertex(cx + ux - vx, cy + uy - vy, c)
    const d = this.vertex(cx + ux + vx, cy + uy + vy, c)
    const e = this.vertex(cx - ux + vx, cy - uy + vy, c)
    this.indices.push(a, b, d, a, d, e)
    return this
  }

  /** Four L-shaped corners around a w × h box; `arm` is the corner length. */
  brackets(w: number, h: number, arm: number, thick: number, c: Rgba): HudMesh {
    const x = w / 2
    const y = h / 2
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        this.quad(sx * (x - arm / 2), sy * (y - thick / 2), arm / 2, thick / 2, c)
        this.quad(sx * (x - thick / 2), sy * (y - arm / 2), thick / 2, arm / 2, c)
      }
    }
    return this
  }

  commit(): void {
    const b = this.builder
    const ic = b.getIndicesCount()
    if (ic > 0) b.eraseIndices(0, ic)
    const vc = b.getVerticesCount()
    if (vc > 0) b.eraseVertices(0, vc)
    if (this.verts.length > 0) {
      b.appendVerticesInterleaved(this.verts)
      b.appendIndices(this.indices)
    }
    b.updateMesh()
  }
}

/** Scales the colour's brightness. On an additive display this reads as opacity. */
export function dim(c: Rgba, k: number): Rgba {
  return new vec4(c.x * k, c.y * k, c.z * k, c.w)
}
