// Bounded, view-only motion state for the scene adapter. Local reveal offsets
// apply to visual content, never to the authored bed/board anchor itself.
import type {BedId} from "./EncounterTypes"
import {BED_IDS} from "./WardGeometry"
import type {BedPresentationState, WardFrameResult} from "./WardInteraction"
import {createSpatialMotion, setSpatialVisibility, spatialMotionView, stepSpatialMotion} from "./SpatialMotion"
import type {SpatialMotion} from "./SpatialMotion"

interface BedMotion { readonly state: BedPresentationState; readonly motion: SpatialMotion }
export interface WardPresentation {
  readonly priority: "routine" | "emergency" | "privacy"
  readonly beds: Readonly<Record<BedId, BedMotion>>
  readonly surfaceKey: string
  readonly surface: SpatialMotion
}
export function createWardPresentation(): WardPresentation {
  const hidden = (): BedMotion => ({state: "hidden", motion: createSpatialMotion()})
  return {priority: "routine", beds: {bed1: hidden(), bed2: hidden(), bed3: hidden(), bed4: hidden()},
    surfaceKey: "none", surface: createSpatialMotion()}
}

export function stepWardPresentation(previous: WardPresentation, frame: WardFrameResult,
  deltaSeconds: number, options: {privacy: boolean; reducedMotion: boolean; reset?: boolean}): WardPresentation {
  const priority = options.privacy ? "privacy" : frame.surface === "emergencyTravel" || frame.surface === "emergencyBedside" ? "emergency" : "routine"
  const interrupt = options.reset === true || priority !== previous.priority
  const beds = {...previous.beds}
  for (const id of BED_IDS) {
    const mode = options.privacy || options.reset ? "hidden" : frame.beds.find(b => b.bedId === id)?.state ?? "hidden"
    const before = previous.beds[id]
    const initial = mode !== before.state && mode !== "hidden" ? createSpatialMotion() : before.motion
    const motion = stepSpatialMotion(setSpatialVisibility(initial, mode !== "hidden", options.reducedMotion, interrupt), deltaSeconds)
    beds[id] = {state: mode, motion}
  }
  const surfaceKey = options.privacy || options.reset ? "none" : (frame.targetBed ?? "ward") + ":" + frame.surface
  const visible = !options.privacy && !options.reset && frame.surface !== "none"
  // The adapter retires the outgoing surface/control root before showing a new key.
  const initial = surfaceKey !== previous.surfaceKey && visible ? createSpatialMotion() : previous.surface
  const surface = stepSpatialMotion(setSpatialVisibility(initial, visible, options.reducedMotion, interrupt), deltaSeconds)
  return {priority, beds, surfaceKey, surface}
}

export function wardPresentationViews(state: WardPresentation) {
  return {surface: spatialMotionView(state.surface),
    beds: BED_IDS.map(bedId => ({bedId, state: state.beds[bedId].state, ...spatialMotionView(state.beds[bedId].motion)}))}
}
