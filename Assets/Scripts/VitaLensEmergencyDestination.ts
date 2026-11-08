import {BED_FOOTPRINT_CM, destinationCue} from "./Core/WardGeometry"
import type {Point3} from "./Core/WardGeometry"
import {WARD_LAYOUT, hudOffset} from "./Core/WardLayout"
import {HudMesh} from "./VitaLensHudMesh"
import {box, hex, label, obj, setText} from "./VitaLensSharedUI"

const INK = hex("#FFB49E")
const LABEL_WIDTH = 22
const LABEL_HEIGHT = 3.5
const ARROW = {left: "←", right: "→", up: "↑", down: "↓"} as const
const TITLE = "Code Blue drill · Bed 3"

function point(v: vec3): Point3 { return [v.x, v.y, v.z] }

/** The display-only destination overlay. The outline inherits the authored bed pose. */
export class VitaLensEmergencyDestination {
  private readonly outline: SceneObject
  private readonly marker: SceneObject
  private readonly direction: SceneObject
  private readonly directionText: Text
  private arrow: string | null = null

  constructor(parent: SceneObject, private readonly bed: SceneObject, material: Material) {
    this.outline = obj(bed, "Bed 3 Drill Outline", new vec3(0, 1, 0))
    this.outline.getTransform().setLocalRotation(quat.fromEulerAngles(-Math.PI / 2, 0, 0))
    const x = BED_FOOTPRINT_CM.width / 2, z = BED_FOOTPRINT_CM.length / 2, stroke = 0.65
    const mesh = new HudMesh(this.outline, material)
    for (const side of [-1, 1]) {
      mesh.quad(0, side * z, x + stroke, stroke, INK)
      mesh.quad(side * x, 0, stroke, z - stroke, INK)
    }
    mesh.commit()
    this.marker = obj(parent, "Bed 3 Drill Marker")
    this.makeLabel(this.marker, TITLE)
    this.direction = obj(parent, "Bed 3 Drill Direction")
    this.directionText = this.makeLabel(this.direction, "")
    this.hide()
  }

  private makeLabel(host: SceneObject, text: string): Text {
    box(host, -LABEL_WIDTH / 2, LABEL_HEIGHT / 2, LABEL_WIDTH, LABEL_HEIGHT, hex("#331D19", 0.9), 0.7)
    return label(host, -LABEL_WIDTH / 2, LABEL_HEIGHT / 2, LABEL_WIDTH, LABEL_HEIGHT,
      text, 1.15, 700, INK, {align: "center"})
  }

  hide(): void {
    this.outline.enabled = false
    this.marker.enabled = false
    this.direction.enabled = false
  }

  /** The footprint outline alone, for a caller that draws its own marker and direction cue. */
  showOutline(): void {
    this.outline.enabled = true
    this.marker.enabled = false
    this.direction.enabled = false
  }

  update(camera: Camera, corner: "left" | "right"): void {
    const bed = this.bed.getTransform()
    const position = bed.getWorldTransform().multiplyPoint(new vec3(...WARD_LAYOUT.destination))
    const view = camera.getTransform(), rotation = view.getWorldRotation(), origin = view.getWorldPosition()
    const cue = destinationCue({position: point(origin), forward: point(rotation.multiplyVec3(new vec3(0, 0, -1))),
      right: point(view.right), up: point(view.up), verticalFovDegrees: camera.fov * 180 / Math.PI, aspect: camera.aspect}, point(position))

    this.outline.enabled = true
    this.marker.enabled = cue?.kind === "marker"
    this.direction.enabled = !!cue?.direction
    if (cue?.kind === "marker") {
      const marker = this.marker.getTransform()
      const scale = Math.max(1, Math.min(3.5, position.distance(origin) / WARD_LAYOUT.depthCm))
      marker.setWorldPosition(position)
      marker.setWorldRotation(rotation)
      marker.setLocalScale(new vec3(scale, scale, scale))
    } else if (cue?.direction) {
      const offset = hudOffset(LABEL_WIDTH, LABEL_HEIGHT, corner)
      this.direction.getTransform().setWorldPosition(origin.add(rotation.multiplyVec3(new vec3(offset.x, offset.y, -WARD_LAYOUT.depthCm))))
      this.direction.getTransform().setWorldRotation(rotation)
      const arrow = ARROW[cue.direction]
      if (arrow !== this.arrow) {
        setText(this.directionText, `${arrow} ${TITLE}`)
        this.arrow = arrow
      }
    }
  }
}
