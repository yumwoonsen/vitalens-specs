// Shared event sequences for the core tests. Not a test file itself.
import assert from "node:assert/strict"

import {createInitialState, reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import type {EncounterEvent, EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"

export function run(events: readonly EncounterEvent[], from: EncounterState = createInitialState()): EncounterState {
  return events.reduce(reduce, from)
}

/** Every intermediate state, including the starting one. */
export function trace(events: readonly EncounterEvent[], from: EncounterState = createInitialState()): EncounterState[] {
  const states = [from]
  for (const e of events) states.push(reduce(states[states.length - 1], e))
  return states
}

/** The event leaves the state object unchanged (guard refused it). */
export function assertNoOp(state: EncounterState, event: EncounterEvent): void {
  assert.equal(reduce(state, event), state, `${event.type} should be refused`)
}

export const TO_IDENTIFY: readonly EncounterEvent[] = [
  {type: "START_DEMO"},
  {type: "CLOCK_IN"},
  {type: "SELECT_BED", bedId: "bed3"},
]

export const VERIFY: readonly EncounterEvent[] = [
  {type: "SCAN_WRISTBAND", wristband: "assigned"},
  {type: "CONFIRM_IDENTIFIER", identifier: "name"},
  {type: "CONFIRM_IDENTIFIER", identifier: "dob"},
]

export const TO_TRANSCRIPT: readonly EncounterEvent[] = [
  {type: "OPEN_NOTE"},
  {type: "GRANT_CONSENT"},
  {type: "START_CAPTURE"},
  {type: "STOP_CAPTURE"},
]

export const TO_REVIEW: readonly EncounterEvent[] = [
  {type: "OPEN_NOTE"},
]

export const CORRECT_RIGHT: readonly EncounterEvent[] = [
  {type: "OPEN_FLAG", flagId: "site"},
  {type: "CORRECT_DRAFT", flagId: "site", optionId: "right"},
]

/** Verified at Bed 3, draft v1 with the seeded flag unresolved, at Review. */
export function draftV1(): EncounterState {
  return run([
    ...TO_IDENTIFY,
    ...VERIFY,
    ...TO_TRANSCRIPT,
    ...TO_REVIEW,
  ])
}

/** Draft corrected to v2 and saved for COW review (the deliberate save; never signed or filed). */
export function savedV2(): EncounterState {
  return run([...CORRECT_RIGHT, {type: "SAVE_FOR_REVIEW"}], draftV1())
}

/** Every event type with a representative payload, for bypass sweeps. */
export const ALL_EVENTS: readonly EncounterEvent[] = [
  {type: "RESET"},
  {type: "TICK"},
  {type: "START_DEMO"},
  {type: "CLOCK_IN"},
  {type: "SELECT_BED", bedId: "bed4"},
  {type: "SCAN_WRISTBAND", wristband: "assigned"},
  {type: "CONFIRM_IDENTIFIER", identifier: "name"},
  {type: "MARK_MISMATCH"},
  {type: "RESCAN"},
  {type: "BACK_TO_BRIEF"},
  {type: "OPEN_CARD", card: "allergy"},
  {type: "CLOSE_CARD"},
  {type: "GRANT_CONSENT"},
  {type: "DECLINE_CONSENT"},
  {type: "RESET_CONSENT"},
  {type: "START_CAPTURE"},
  {type: "STOP_CAPTURE"},
  {type: "GENERATE_DRAFT"},
  {type: "OPEN_FLAG", flagId: "site"},
  {type: "CORRECT_DRAFT", flagId: "site", optionId: "right"},
  {type: "CLOSE_FLAG"},
  {type: "REJECT_DRAFT"},
  {type: "NEW_CAPTURE"},
  {type: "SAVE_FOR_REVIEW"},
  {type: "AMEND_NOTE"},
  {type: "OPEN_EMERGENCY"},
  {type: "CLOSE_EMERGENCY"},
  {type: "EMERGENCY_SCAN"},
  {type: "BUILD_HANDOVER"},
  {type: "APPROVE_HANDOVER"},
  {type: "NAV_BACK"},
  {type: "NAV_NEXT"},
  {type: "PRIVACY_ON"},
  {type: "PRIVACY_OFF"},
  {type: "TOGGLE_MENU"},
  {type: "REQUEST_SWITCH"},
  {type: "REQUEST_RESET"},
  {type: "CONFIRM_PENDING"},
  {type: "CANCEL_PENDING"},
  {type: "MINIMISE"},
  {type: "RESTORE"},
  {type: "SET_MINI_CORNER", corner: "right"},
  {type: "AWAY_FROM_BED"},
  {type: "NEAR_BED"},
]

/** Events that only move between phases or change the view. None may save, approve or build. */
export const NAVIGATION_AND_VIEW: readonly EncounterEvent[] = [
  {type: "OPEN_NOTE"},
  {type: "OPEN_NOTE"},
  {type: "OPEN_OVERVIEW"},
  {type: "OPEN_OVERVIEW"},
  {type: "OPEN_NOTE"},
  {type: "TOGGLE_MENU"},
  {type: "TOGGLE_MENU"},
  {type: "MINIMISE"},
  {type: "RESTORE"},
  {type: "AWAY_FROM_BED"},
  {type: "NEAR_BED"},
  {type: "PRIVACY_ON"},
  {type: "PRIVACY_OFF"},
  {type: "SET_MINI_CORNER", corner: "right"},
  {type: "CLOSE_FLAG"},
  {type: "CLOSE_CARD"},
  {type: "TICK"},
]

export function ticks(n: number): EncounterEvent[] {
  return Array.from({length: n}, () => ({type: "TICK"}) as const)
}
