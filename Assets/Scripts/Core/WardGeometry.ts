// Pure centimetre geometry. Runtime adapters supply authored world poses; these
// helpers never move scene objects or infer patient identity from a bed location.
import type {BedId} from "./EncounterTypes"
import {WARD_LAYOUT} from "./WardLayout"

export type Point3 = readonly [number, number, number]
export interface BedPose {
  readonly bedId: BedId
  readonly position: Point3
  readonly yawDegrees: number
  /** Measured/authored width and length; synthetic default is 110 x 220 cm. */
  readonly footprintCm?: readonly [number, number]
}
export interface BedGeometry {
  readonly bedId: BedId
  readonly centre: Point3
  readonly approach: Point3
  readonly wrist: Point3
  readonly board: Point3
  readonly destination: Point3
  readonly outline: readonly Point3[]
}
export const BED_IDS: readonly BedId[] = ["bed1", "bed2", "bed3", "bed4"]
export const BED_FOOTPRINT_CM = {width: 110, length: 220} as const

export function validBedPose(pose: BedPose): boolean {
  return BED_IDS.indexOf(pose.bedId) >= 0 && [...pose.position, pose.yawDegrees].every(Number.isFinite) &&
    (!pose.footprintCm || pose.footprintCm.every(n => Number.isFinite(n) && n > 0))
}

/** Runtime Y rotation: +X right, +Y up, -Z forward. */
export function bedPoint(pose: BedPose, local: Point3): Point3 {
  const angle = pose.yawDegrees * Math.PI / 180
  const c = Math.cos(angle), s = Math.sin(angle)
  return [pose.position[0] + c * local[0] + s * local[2],
    pose.position[1] + local[1],
    pose.position[2] - s * local[0] + c * local[2]]
}

export function bedGeometry(pose: BedPose, mirrored = false, boardWidthCm: number = WARD_LAYOUT.surfaces.board[0]): BedGeometry {
  const halfWidth = (pose.footprintCm?.[0] ?? BED_FOOTPRINT_CM.width) / 2
  const halfLength = (pose.footprintCm?.[1] ?? BED_FOOTPRINT_CM.length) / 2
  const width = Number.isFinite(boardWidthCm) && boardWidthCm > 0 ? boardWidthCm : WARD_LAYOUT.surfaces.board[0]
  const boardSide = Math.max(WARD_LAYOUT.board[0], halfWidth + width / 2 + 10)
  const corners: readonly Point3[] = [[-halfWidth, 0, -halfLength], [halfWidth, 0, -halfLength],
    [halfWidth, 0, halfLength], [-halfWidth, 0, halfLength], [-halfWidth, 0, -halfLength]]
  return {
    bedId: pose.bedId, centre: pose.position,
    approach: bedPoint(pose, [0, 0, WARD_LAYOUT.approach[2]]),
    wrist: bedPoint(pose, WARD_LAYOUT.wrist),
    board: bedPoint(pose, [boardSide * (mirrored ? -1 : 1), WARD_LAYOUT.board[1], WARD_LAYOUT.board[2]]),
    destination: bedPoint(pose, WARD_LAYOUT.destination),
    outline: corners.map(p => bedPoint(pose, p)),
  }
}

export function horizontalDistance(a: Point3, b: Point3): number {
  if (![a[0], a[2], b[0], b[2]].every(Number.isFinite)) return Infinity
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

export interface CameraPose {
  readonly position: Point3
  readonly forward: Point3
  readonly right: Point3
  readonly up: Point3
  readonly verticalFovDegrees: number
  readonly aspect: number
}
export interface DestinationCue {
  readonly kind: "marker" | "direction"
  readonly direction: "left" | "right" | "up" | "down" | null
  readonly bearingRadians: number
  readonly position: Point3
}

/** Frustum visibility, not obstacle detection or a path-finding claim. */
export function destinationCue(camera: CameraPose, point: Point3): DestinationCue | null {
  if (![...camera.position, ...camera.forward, ...camera.right, ...camera.up, ...point,
    camera.verticalFovDegrees, camera.aspect].every(Number.isFinite) ||
    camera.verticalFovDegrees <= 6 || camera.verticalFovDegrees >= 180 || camera.aspect <= 0) return null
  const delta: Point3 = [point[0] - camera.position[0], point[1] - camera.position[1], point[2] - camera.position[2]]
  const dot = (v: Point3) => delta[0] * v[0] + delta[1] * v[1] + delta[2] * v[2]
  const x = dot(camera.right), y = dot(camera.up), z = dot(camera.forward)
  const vertical = camera.verticalFovDegrees * Math.PI / 360
  const margin = 3 * Math.PI / 180
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
  const yaw = Math.atan2(x, z), pitch = Math.atan2(y, Math.hypot(x, z))
  if (z > 0 && Math.abs(yaw) < Math.max(0, horizontal - margin) && Math.abs(pitch) < vertical - margin) {
    return {kind: "marker", direction: null, bearingRadians: yaw, position: point}
  }
  const direction = z <= 0 || Math.abs(yaw) / horizontal >= Math.abs(pitch) / vertical
    ? (x < 0 ? "left" : "right") : (y < 0 ? "down" : "up")
  return {kind: "direction", direction, bearingRadians: yaw, position: point}
}
