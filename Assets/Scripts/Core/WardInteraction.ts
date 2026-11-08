// Scene decisions only. Callers dispatch the returned existing encounter events
// through the authoritative reducer. Nothing here verifies, saves or approves.
import type {BedId, EncounterEvent, EncounterState} from "./EncounterTypes"
import {assignmentFor} from "./EncounterFixtures"
import {bedGeometry, BED_IDS, destinationCue, horizontalDistance, validBedPose} from "./WardGeometry"
import type {BedGeometry, BedPose, CameraPose, DestinationCue} from "./WardGeometry"
import {WARD_LAYOUT} from "./WardLayout"

export type BedPresentationState = "hidden" | "marker" | "preview" | "selected" | "emergency"
export type CollapseReason = "manual" | "distance" | null
export type WardSurface = "none" | "destination" | "verification" | "bedside" | "compact" | "emergencyTravel" | "emergencyBedside"
export interface BedPresentation {
  readonly bedId: BedId
  readonly state: BedPresentationState
  readonly geometry: BedGeometry
  readonly markerVisible: boolean
  readonly selectable: boolean
  readonly nextNeed: string
}
export interface WardInteractionState {
  readonly near: Readonly<Record<BedId, boolean>>
  readonly previewBed: BedId | null
  readonly challenger: BedId | null
  readonly challengerSeconds: number
  readonly collapseReason: CollapseReason
  readonly activeBed: BedId | null
  readonly drill: "armed" | "counting" | "consumed"
  readonly drillSeconds: number
}
export interface WardFrame {
  readonly encounter: EncounterState
  readonly camera: CameraPose
  readonly beds: readonly BedPose[]
  readonly deltaSeconds: number
  /** True only when the actual simulated draft is shown, never while loading. */
  readonly draftVisible: boolean
  readonly mirrored?: boolean
  /** Actual panel width from the screen adapter's local bounds. */
  readonly boardWidthCm?: number
}
export interface WardFrameResult {
  readonly state: WardInteractionState
  readonly beds: readonly BedPresentation[]
  readonly surface: WardSurface
  readonly targetBed: BedId | null
  readonly cue: DestinationCue | null
  readonly canScan: boolean
  readonly drillCountdown: number | null
  readonly events: readonly EncounterEvent[]
}

export function createWardInteraction(): WardInteractionState {
  return {near: {bed1: false, bed2: false, bed3: false, bed4: false}, previewBed: null,
    challenger: null, challengerSeconds: 0, collapseReason: null, activeBed: null,
    drill: "armed", drillSeconds: 0}
}

/** Observe only reducer-accepted intent events, including confirmed reset/switch. */
export function observeWardEvent(state: WardInteractionState, event: EncounterEvent,
  before: EncounterState, after: EncounterState): WardInteractionState {
  if (before === after) return state
  if (event.type === "RESET" || (event.type === "CONFIRM_PENDING" && before.view.pending === "reset")) return createWardInteraction()
  if (after.phase === "emergency") return {...state, drill: "consumed", collapseReason: null, previewBed: null, challenger: null, challengerSeconds: 0}
  if (event.type === "CONFIRM_PENDING" && before.view.pending === "switch") {
    return {...createWardInteraction(), drill: "consumed"}
  }
  if (event.type === "MINIMISE") return {...state, collapseReason: "manual"}
  if (event.type === "RESTORE") return {...state, collapseReason: null}
  if (before.bedId !== after.bedId) {
    return {...state, activeBed: after.bedId, collapseReason: null,
      previewBed: null, challenger: null, challengerSeconds: 0,
      drill: state.drill === "counting" ? "consumed" : state.drill}
  }
  return state
}

function seconds(dt: number): number { return Number.isFinite(dt) ? Math.max(0, dt) : 0 }

/** Advances the demo clock independently of which spatial views the scene has wired. */
export function advanceWardDrill(state: WardInteractionState, encounter: EncounterState,
  draftVisible: boolean, deltaSeconds: number): {state: WardInteractionState; open: boolean} {
  if (encounter.phase === "emergency") return {state: {...state, drill: "consumed"}, open: false}
  const eligible = encounter.session === "demo" && encounter.bedId === "bed2" && encounter.verification === "verified"
  const paused = encounter.privacy || encounter.view.menuOpen || encounter.view.pending !== "none"
  const note = encounter.note
  if (state.drill === "armed" && eligible && !paused && draftVisible &&
    note && (note.status === "draft" || note.status === "edited")) {
    return {state: {...state, drill: "counting", drillSeconds: 0}, open: false}
  }
  if (state.drill !== "counting") return {state, open: false}
  if (!eligible) return {state: {...state, drill: "consumed"}, open: false}
  if (paused) return {state, open: false}
  const elapsed = state.drillSeconds + seconds(deltaSeconds)
  return {state: {...state, drillSeconds: Math.min(5, elapsed), drill: elapsed >= 5 ? "consumed" : "counting"}, open: elapsed >= 5}
}

export function stepWardInteraction(previous: WardInteractionState, frame: WardFrame): WardFrameResult {
  const s = frame.encounter, dt = seconds(frame.deltaSeconds)
  // Missing, malformed or duplicate anchors must not resolve to another bed.
  const geometries = frame.beds.filter(b => validBedPose(b) &&
    frame.beds.filter(other => other.bedId === b.bedId).length === 1).map(b => bedGeometry(b, frame.mirrored, frame.boardWidthCm))
  const distance = (id: BedId) => {
    const bed = geometries.find(b => b.bedId === id)
    return bed ? horizontalDistance(frame.camera.position, bed.approach) : Infinity
  }
  const near = {...previous.near}
  for (const id of BED_IDS) {
    const d = distance(id)
    near[id] = previous.near[id] ? d <= WARD_LAYOUT.exitCm : d < WARD_LAYOUT.enterCm
  }
  let state: WardInteractionState = {...previous, near}
  const events: EncounterEvent[] = []
  const emergency = s.phase === "emergency"
  const active = s.bedId
  if (active !== state.activeBed) state = {...state, activeBed: active, collapseReason: null,
    drill: state.drill === "counting" ? "consumed" : state.drill}
  if (emergency) state = {...state, drill: "consumed", collapseReason: null}

  // A single, patient-bound demo timer. It emits only OPEN_EMERGENCY.
  const paused = s.privacy || s.view.menuOpen || s.view.pending !== "none"
  const drill = advanceWardDrill(state, s, frame.draftVisible, dt)
  state = drill.state
  if (drill.open) events.push({type: "OPEN_EMERGENCY"})

  if (s.privacy || paused || emergency || s.session !== "demo" || active !== null || s.phase !== "clockIn") {
    state = {...state, previewBed: null, challenger: null, challengerSeconds: 0}
  } else {
    // Sort a copy, with deterministic bed order for an exact tie. Never change selection.
    const candidates = BED_IDS.filter(id => near[id]).sort((a, b) => distance(a) - distance(b))
    const nearest = candidates[0] ?? null
    const current = state.previewBed
    if (!current || !near[current]) {
      state = {...state, previewBed: nearest, challenger: null, challengerSeconds: 0}
    } else if (nearest && nearest !== current && distance(current) - distance(nearest) >= 20) {
      const elapsed = state.challenger === nearest ? state.challengerSeconds + dt : dt
      state = elapsed + 1e-9 >= 0.25
        ? {...state, previewBed: nearest, challenger: null, challengerSeconds: 0}
        : {...state, challenger: nearest, challengerSeconds: elapsed}
    } else state = {...state, challenger: null, challengerSeconds: 0}
  }

  const activeNear = active !== null && near[active]
  if (!s.privacy && !s.view.menuOpen && s.session === "demo") {
    if (emergency) {
      if (near.bed3 !== s.emergencyNear) events.push({type: near.bed3 ? "EMERGENCY_NEAR" : "EMERGENCY_AWAY"})
    } else if (active && s.verification === "verified" && s.phase !== "handover") {
      if (!activeNear && !s.view.minimised) {
        state = {...state, collapseReason: "distance"}
        events.push({type: "AWAY_FROM_BED"})
      } else if (activeNear && s.view.minimised && state.collapseReason === "distance") {
        state = {...state, collapseReason: null}
        events.push({type: "NEAR_BED"})
      }
    }
  }

  const targetBed: BedId | null = emergency ? "bed3" : active
  const target = geometries.find(b => b.bedId === targetBed)
  const cue = !s.privacy && target ? destinationCue(frame.camera, target.destination) : null
  let surface: WardSurface = "none"
  if (!s.privacy && s.session === "demo" && s.phase !== "handover") {
    if (emergency) surface = near.bed3 ? "emergencyBedside" : "emergencyTravel"
    else if (active) surface = !activeNear ? (s.verification === "verified" ? "compact" : "destination")
      : s.view.minimised && state.collapseReason !== "distance" ? "compact"
      : s.verification === "verified" ? "bedside" : "verification"
  }
  const beds = geometries.map(geometry => {
    const id = geometry.bedId
    let mode: BedPresentationState = "hidden"
    if (!s.privacy && s.session === "demo" && s.phase !== "boot" && s.phase !== "handover") {
      mode = emergency ? (id === "bed3" ? "emergency" : "hidden")
        : active ? (id === active ? "selected" : "hidden")
        : id === state.previewBed ? "preview" : "marker"
    }
    const markerVisible = mode !== "hidden" && destinationCue(frame.camera, geometry.destination)?.kind === "marker"
    return {bedId: id, state: mode, geometry, markerVisible,
      selectable: markerVisible && !paused && !active && !emergency && (mode === "marker" || mode === "preview"),
      nextNeed: assignmentFor(id).needs[0]?.label ?? "Unknown"}
  })
  return {state, beds, surface, targetBed, cue,
    canScan: !paused && !!active && activeNear && !s.view.minimised && s.phase === "identify" && s.verification === "idle",
    drillCountdown: state.drill === "counting" ? Math.max(0, 5 - state.drillSeconds) : null, events}
}
