// Per-bed look for the four patient bodies under the bed anchors (preview only, with the ward).
// All four beds share one mesh set from tools/build_ward_patient_body.py; variety is colour and hair
// only, plus a small width difference under the blanket. Keep LOOKS in sync with that generator,
// which also writes demo/ward/patient-looks.json for the preview-source bake.

interface Look {
  readonly skin: readonly [number, number, number]
  readonly hair: readonly [number, number, number]
  readonly gown: readonly [number, number, number]
  /** Width of the shape under the blanket, 1 = as authored. */
  readonly size: number
  readonly bun: boolean
}

/** Fictional patients: Bed 1 K. Wong, Bed 2 A. Hakim, Bed 3 A. L. Tan, Bed 4 S. Nair. */
export const LOOKS: readonly Look[] = [
  {skin: [0.62, 0.46, 0.36], hair: [0.42, 0.42, 0.41], gown: [0.45, 0.62, 0.68], size: 1.0, bun: false},
  {skin: [0.46, 0.31, 0.22], hair: [0.55, 0.55, 0.53], gown: [0.50, 0.66, 0.60], size: 1.04, bun: false},
  {skin: [0.66, 0.50, 0.40], hair: [0.86, 0.86, 0.84], gown: [0.55, 0.58, 0.72], size: 0.95, bun: true},
  {skin: [0.33, 0.21, 0.15], hair: [0.06, 0.05, 0.05], gown: [0.44, 0.62, 0.64], size: 1.0, bun: false},
]
const SKIN_PARTS = ["Forearm", "Hand palm down", "Thumb", "Finger 1", "Finger 2", "Finger 3", "Finger 4"]

function find(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) return root
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const hit = find(root.getChild(i), name)
    if (hit) return hit
  }
  return null
}

function visual(so: SceneObject | null): RenderMeshVisual | null {
  return so ? (so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual) : null
}

function tinted(base: Material, rgb: readonly [number, number, number]): Material {
  const m = base.clone()
  m.mainPass.baseColorFactor = new vec4(rgb[0], rgb[1], rgb[2], 1)
  return m
}

/**
 * Colours one bed's body and gives it hair. `bed` is the bed anchor, `index` 0-3 for Bed 1-4.
 * Safe to call once per bed; a missing part or mesh is skipped.
 */
export function applyPatientLook(bed: SceneObject, index: number, hairMesh: RenderMesh | null, bunMesh: RenderMesh | null): void {
  const look = LOOKS[index]
  const body = find(bed, "Patient body")
  const skinVisual = visual(body ? find(body, "Forearm") : null)
  if (!look || !body || !skinVisual) return
  const base = skinVisual.mainMaterial
  const skin = tinted(base, look.skin)
  for (const name of SKIN_PARTS) {
    const v = visual(find(body, name))
    if (v) v.mainMaterial = skin
  }
  const gown = visual(find(body, "Upper arm"))
  if (gown) gown.mainMaterial = tinted(base, look.gown)
  const drape = find(body, "Torso under blanket")
  if (drape) {
    const t = drape.getTransform()
    const s = t.getLocalScale()
    t.setLocalScale(new vec3(look.size, s.y, s.z))
  }
  const hair = tinted(base, look.hair)
  const add = (name: string, mesh: RenderMesh | null) => {
    if (!mesh || find(body, name)) return
    const so = global.scene.createSceneObject(name)
    so.setParent(body)
    const v = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh = mesh
    v.mainMaterial = hair
  }
  add("Hair", hairMesh)
  if (look.bun) add("Hair bun", bunMesh)
}
