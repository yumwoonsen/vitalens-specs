// View-only transitions. No timers in this module emit encounter events.
export interface SpatialMotion {
  readonly visible: boolean
  readonly from: number
  readonly progress: number
  readonly elapsed: number
  readonly duration: number
}
export const MOTION = {revealSeconds: 0.18, dismissSeconds: 0.12, offsetCm: 1} as const
export function createSpatialMotion(): SpatialMotion {
  return {visible: false, from: 0, progress: 0, elapsed: 0, duration: 0}
}
export function setSpatialVisibility(state: SpatialMotion, visible: boolean,
  reducedMotion = false, interrupt = false): SpatialMotion {
  if (reducedMotion || interrupt) {
    return {visible, from: visible ? 1 : 0, progress: visible ? 1 : 0, elapsed: 0, duration: 0}
  }
  if (visible === state.visible) return state
  return {visible, from: state.progress, progress: state.progress, elapsed: 0,
    duration: visible ? MOTION.revealSeconds : MOTION.dismissSeconds}
}
export function stepSpatialMotion(state: SpatialMotion, deltaSeconds: number): SpatialMotion {
  if (state.duration === 0 || state.elapsed >= state.duration) return state
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  const elapsed = Math.min(state.duration, state.elapsed + dt)
  const ease = 1 - Math.pow(1 - elapsed / state.duration, 3)
  return {...state, elapsed, progress: state.from + ((state.visible ? 1 : 0) - state.from) * ease}
}
export function spatialMotionView(state: SpatialMotion) {
  return {opacity: state.progress, offsetCm: MOTION.offsetCm * (1 - state.progress),
    render: state.visible || state.progress > 0,
    controlsEnabled: state.visible && state.progress >= 1}
}
