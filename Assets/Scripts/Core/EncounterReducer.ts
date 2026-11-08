// VitalLens encounter reducer (docs/contracts/encounter-state.md).
// Pure function: reduce(state, event) returns the next state and never mutates
// its input. A guard that fails returns the same state object unchanged, so
// callers and selectors can test "was this accepted?" with identity.
import {assignmentFor, DRAFT_FLAGS, flagFixture, hasSampleTranscript, MISMATCH_PATIENT_ID, flagsFor} from "./EncounterFixtures"
import type {
  Capture,
  EncounterEvent,
  EncounterState,
  NoteHistoryEntry,
  NoteVersion,
  Phase,
} from "./EncounterTypes"

export const PHASES: readonly Phase[] = ["boot", "clockIn", "identify", "round", "review", "emergency", "handover"]

export function createInitialState(): EncounterState {
  return {
    bodyView: "overview", interruptedWork: {}, emergencyBand: "none", emergencyNear: false,
    emergencyContact: false, emergencyBrief: false, downstream: [],
    simulated: true,
    phase: "boot",
    returnPhase: null,
    session: "none",
    bedId: null,
    verification: "idle",
    confirmed: {name: false, dob: false},
    scannedPatientId: null,
    consent: "unasked",
    capture: "idle",
    privacy: false,
    transcript: "none",
    note: null,
    noteHistory: [],
    handover: null,
    emergencyPatientId: null,
    view: {openCard: null, openFlag: null, menuOpen: false, pending: "none", minimised: false, miniCorner: "right"},
  }
}

/** True when the patient for the current bed is verified with both identifiers. */
export function isVerified(s: EncounterState): boolean {
  return s.bedId !== null && s.verification === "verified"
}

/** True when the reducer would accept the event. */
export function canDispatch(s: EncounterState, event: EncounterEvent): boolean {
  return reduce(s, event) !== s
}

function hasEncounterContent(s: EncounterState): boolean {
  return (
    s.verification === "verified" ||
    s.consent !== "unasked" ||
    s.capture !== "idle" ||
    s.transcript !== "none" ||
    s.note !== null ||
    s.noteHistory.length > 0 ||
    s.handover !== null
  )
}

function interrupt(capture: Capture): Capture {
  return capture === "recording" ? "interrupted" : capture
}

function isReviewable(n: NoteVersion | null): n is NoteVersion {
  return n !== null && (n.status === "draft" || n.status === "edited")
}

function allResolved(note: NoteVersion): boolean {
  return note.flags.every((f) => f.resolution === "right" || f.resolution === "unknown")
}

function nextVersion(s: EncounterState): number {
  let max = s.note ? s.note.version : 0
  for (const h of s.noteHistory) if (h.version > max) max = h.version
  for (const x of s.downstream) if (x.patientId === s.scannedPatientId && x.version > max) max=x.version
  const held=s.scannedPatientId ? s.interruptedWork[s.scannedPatientId] : null
  if (held?.note && held.note.version > max) max=held.note.version
  return max + 1
}

function archive(note: NoteVersion, outcome: NoteHistoryEntry["outcome"]): NoteHistoryEntry {
  return {version: note.version, status: note.status, flags: note.flags, outcome}
}

/** Everything that belongs to one patient encounter, back to its empty value. */
function clearEncounter(s: EncounterState): EncounterState {
  const initial = createInitialState()
  return {
    ...s,
    returnPhase: null,
    bedId: null,
    verification: initial.verification,
    confirmed: initial.confirmed,
    scannedPatientId: null,
    consent: initial.consent,
    capture: initial.capture,
    privacy: false,
    transcript: initial.transcript,
    note: null,
    noteHistory: [],
    handover: null,
    emergencyPatientId: null,
    view: {...s.view, openCard: null, openFlag: null, menuOpen: false, pending: "none", minimised: false},
  }
}

function moveTo(s: EncounterState, phase: Phase, returnPhase: Phase | null): EncounterState {
  return {
    ...s,
    phase,
    returnPhase,
    emergencyPatientId: null,
    capture: interrupt(s.capture),
    view: {...s.view, openCard: null, openFlag: null, minimised: phase === "emergency" ? false : s.view.minimised},
  }
}

function beginEmergency(s: EncounterState): EncounterState {
  const held = {...s.interruptedWork}
  if (s.scannedPatientId && (s.transcript !== "none" || s.note)) held[s.scannedPatientId] = {
    transcript:s.transcript,note:s.note,noteHistory:s.noteHistory,handover:s.handover,
  }
  return {...clearEncounter(s),phase:"emergency",privacy:s.privacy,bodyView:"overview",interruptedWork:held,
    emergencyPatientId:"pt-target",emergencyBand:"none",emergencyNear:false,emergencyContact:false,emergencyBrief:false}
}
function endEmergency(s: EncounterState): EncounterState {
  return {...clearEncounter(s),phase:"clockIn",privacy:s.privacy,bodyView:"overview",emergencyBand:"none",emergencyNear:false,emergencyContact:false,emergencyBrief:false}
}

/** Note and handover actions. The emergency view is read-only (owner round 2, 9b), so they are refused there. */
const DOCUMENTATION: readonly EncounterEvent["type"][] = [
  "OPEN_FLAG",
  "CORRECT_DRAFT",
  "REJECT_DRAFT",
  "NEW_CAPTURE",
  "SAVE_FOR_REVIEW",
  "AMEND_NOTE",
  "BUILD_HANDOVER",
  "APPROVE_HANDOVER",
]

export function reduce(s: EncounterState, event: EncounterEvent): EncounterState {
  if (s.phase === "emergency" && DOCUMENTATION.indexOf(event.type) >= 0) return s
  const verified = isVerified(s)
  const note = s.note

  switch (event.type) {
    case "RESET":
      return createInitialState()

    case "TICK":
      return s

    case "START_DEMO":
      return s.phase === "boot" ? {...s, phase: "clockIn"} : s

    case "CLOCK_IN":
      return s.phase === "clockIn" && s.session === "none" ? {...s, session: "demo"} : s

    case "SELECT_BED": {
      if (s.session !== "demo" || s.phase !== "clockIn") return s
      if (s.bedId === event.bedId) return {...s, phase: "identify"}
      if (s.bedId !== null && hasEncounterContent(s)) return s
      return {
        ...s,
        phase: "identify",
        bedId: event.bedId,
        verification: "idle",
        confirmed: {name: false, dob: false},
        scannedPatientId: null,
      }
    }

    case "SCAN_WRISTBAND": {
      if (s.phase !== "identify" || s.bedId === null || s.verification !== "idle") return s
      const bed = assignmentFor(s.bedId)
      const scanned = event.wristband === "mismatchDemo" ? MISMATCH_PATIENT_ID : bed.wristbandPatientId
      return {
        ...s,
        scannedPatientId: scanned,
        verification: scanned === bed.patientId ? "scanned" : "mismatch",
        confirmed: {name: false, dob: false},
      }
    }

    case "CONFIRM_IDENTIFIER": {
      if (s.verification !== "scanned" || s.confirmed[event.identifier]) return s
      const confirmed = {...s.confirmed, [event.identifier]: true}
      return {...s, confirmed, verification: confirmed.name && confirmed.dob ? "verified" : "scanned", phase: confirmed.name && confirmed.dob ? "round" : s.phase, bodyView:"overview"}
    }

    case "MARK_MISMATCH":
      if (s.bedId === null || (s.verification !== "idle" && s.verification !== "scanned")) return s
      return {...s, verification: "mismatch", confirmed: {name: false, dob: false}}

    case "RESCAN":
      if (s.verification !== "scanned" && s.verification !== "mismatch") return s
      return {...s, verification: "idle", scannedPatientId: null, confirmed: {name: false, dob: false}}

    case "BACK_TO_BRIEF":
      if (s.phase !== "identify" || verified) return s
      return {
        ...s,
        phase: "clockIn",
        bedId: null,
        verification: "idle",
        scannedPatientId: null,
        confirmed: {name: false, dob: false},
      }

    case "OPEN_CARD":
      if (!verified || s.phase !== "round" || s.privacy || s.view.openCard === event.card) return s
      return {...s, view: {...s.view, openCard: event.card}}

    case "CLOSE_CARD":
      return s.view.openCard === null ? s : {...s, view: {...s.view, openCard: null}}

    case "GRANT_CONSENT":
      return verified && s.consent === "unasked" ? {...s, consent: "granted"} : s

    case "DECLINE_CONSENT":
      return verified && s.consent === "unasked" ? {...s, consent: "declined"} : s

    case "RESET_CONSENT":
      return s.consent === "declined" ? {...s, consent: "unasked"} : s

    case "START_CAPTURE":
      if (
        !verified ||
        s.scannedPatientId === null ||
        !hasSampleTranscript(s.scannedPatientId) ||
        s.consent !== "granted" ||
        s.privacy ||
        (s.capture !== "idle" && s.capture !== "interrupted") ||
        note !== null
      ) {
        return s
      }
      return {...s, capture: "recording"}

    case "STOP_CAPTURE":
      return s.capture === "recording" ? {...s, capture: "stopped", transcript: "sample", phase:"review", bodyView:"note",
        note:{version:nextVersion(s),status:"draft",flags:flagsFor(s.scannedPatientId).map(f=>({flagId:f.id,resolution:null}))}} : s

    case "GENERATE_DRAFT":
      if (!verified || s.consent !== "granted" || s.transcript !== "sample" || note !== null) return s
      return {
        ...s,
        note: {
          version: nextVersion(s),
          status: "draft",
          flags: flagsFor(s.scannedPatientId).map((f) => ({flagId: f.id, resolution: null})),
        },
      }

    case "OPEN_FLAG":
      if (!verified || !isReviewable(note) || s.view.openFlag === event.flagId) return s
      if (!note.flags.some((f) => f.flagId === event.flagId)) return s
      return {...s, view: {...s.view, openFlag: event.flagId}}

    case "CORRECT_DRAFT": {
      if (!verified || !isReviewable(note) || s.view.openFlag !== event.flagId) return s
      if (!flagFixture(event.flagId,s.scannedPatientId).options.some((o) => o.id === event.optionId) || event.optionId === "left") return s
      const flags = note.flags.map((f) => (f.flagId === event.flagId ? {...f, resolution: event.optionId} : f))
      const view = {...s.view, openFlag: null}
      if (note.status === "edited") {
        // An edited version was never saved for review or summarised, so it is updated in place.
        return {...s, note: {...note, flags}, view}
      }
      return {
        ...s,
        note: {version: nextVersion(s), status: "edited", flags},
        noteHistory: [...s.noteHistory, archive(note, "superseded")],
        view,
      }
    }

    case "CLOSE_FLAG":
      return s.view.openFlag === null ? s : {...s, view: {...s.view, openFlag: null}}

    case "REJECT_DRAFT":
      if (!verified || !isReviewable(note)) return s
      return {...s, note: {...note, status: "rejected"}, view: {...s.view, openFlag: null}}

    case "NEW_CAPTURE":
      if (!verified || note === null || note.status !== "rejected") return s
      return {
        ...s,
        note: null,
        noteHistory: [...s.noteHistory, archive(note, "rejected")],
        transcript: "none",
        capture: "idle",
      }

    case "SAVE_FOR_REVIEW":
      // The deliberate "Save for COW review" action. The glasses never sign or file.
      if (!verified || !isReviewable(note) || !allResolved(note)) return s
      return {...s, note: {...note, status: "pendingReview"}, view: {...s.view, openFlag: null}}

    case "AMEND_NOTE": {
      if (!verified || note === null || note.status !== "pendingReview") return s
      const handover =
        s.handover !== null && (s.handover.status === "built" || s.handover.status === "approved")
          ? {...s.handover, status: "stale" as const}
          : s.handover
      const firstFlag = note.flags.length > 0 ? note.flags[0].flagId : null
      return {
        ...s,
        note: {version: nextVersion(s), status: "edited", flags: note.flags.map((f) => ({...f, resolution: null}))},
        noteHistory: [...s.noteHistory, archive(note, "superseded")],
        handover,
        view: {...s.view, openFlag: firstFlag},
      }
    }

    case "OPEN_EMERGENCY":
      if (s.session !== "demo" || s.phase === "emergency") return s
      return beginEmergency(s)

    case "CLOSE_EMERGENCY":
      if (s.phase !== "emergency") return s
      return endEmergency(s)

    case "EMERGENCY_SCAN":
      return s.phase === "emergency" && s.emergencyBand !== "matched" && !s.privacy ? {...s,emergencyBand:"matched"} : s
    case "EMERGENCY_WRONG_BAND":
      return s.phase === "emergency" && !s.privacy ? {...s,emergencyBand:"mismatch"} : s
    case "EMERGENCY_NEAR":
      return s.phase === "emergency" && !s.emergencyNear ? {...s,emergencyNear:true,emergencyBrief:false} : s
    case "EMERGENCY_AWAY":
      return s.phase === "emergency" && s.emergencyNear ? {...s,emergencyNear:false,emergencyBrief:false} : s
    case "EMERGENCY_CONTACT":
      return s.phase === "emergency" && !s.privacy && !s.emergencyContact ? {...s,emergencyContact:true} : s
    case "EMERGENCY_BRIEF":
      return s.phase === "emergency" && !s.privacy && !s.emergencyBrief ? {...s,emergencyBrief:true} : s
    case "EMERGENCY_CLOSE_BRIEF":
      return s.emergencyBrief ? {...s,emergencyBrief:false} : s
    case "OPEN_HANDOVER":
      return verified && note?.status === "pendingReview" && s.phase !== "emergency" && !s.privacy ? {...s,phase:"handover"} : s
    case "OPEN_OVERVIEW":
    case "OPEN_CARE":
    case "OPEN_NOTE":
    case "OPEN_COW":
      if (!verified || s.phase === "emergency" || s.privacy || (event.type === "OPEN_COW" && s.note?.status !== "pendingReview")) return s
      return {...s,capture:event.type !== "OPEN_NOTE" ? interrupt(s.capture) : s.capture,bodyView:event.type === "OPEN_CARE" ? "care" : event.type === "OPEN_NOTE" ? "note" : event.type === "OPEN_COW" ? "cow" : "overview",phase:event.type === "OPEN_COW" || (event.type === "OPEN_NOTE" && s.note) ? "review" : "round"}
    case "REOPEN_WORK": {
      if (!verified || !s.scannedPatientId || s.privacy || s.note || s.transcript !== "none") return s
      const held=s.interruptedWork[s.scannedPatientId]
      if (!held) return s
      const remaining={...s.interruptedWork};delete remaining[s.scannedPatientId]
      return {...s,...held,interruptedWork:remaining,bodyView:"note",phase:held.note ? "review" : "round",consent:"unasked",capture:"idle"}
    }
    case "COW_SIGN":
    case "EHR_RECEIVE": {
      if (!verified || !s.scannedPatientId || !note || note.status !== "pendingReview" || s.phase === "emergency") return s
      const current=s.downstream.find(x=>x.patientId === s.scannedPatientId && x.version === note.version)
      if (event.type === "COW_SIGN" && current || event.type === "EHR_RECEIVE" && (!current || current.stage !== "signed")) return s
      return {...s,downstream:[...s.downstream.filter(x=>x !== current),{patientId:s.scannedPatientId,version:note.version,stage:event.type === "COW_SIGN" ? "signed" : "received"}]}
    }

    case "BUILD_HANDOVER":
      if (!verified || note === null || note.status !== "pendingReview") return s
      if (s.handover !== null && s.handover.status !== "stale" && s.handover.source.version === note.version) return s
      return {...s, handover: {status: "built", source: note}}

    case "APPROVE_HANDOVER":
      if (!verified || s.handover === null || s.handover.status !== "built") return s
      return {...s, handover: {...s.handover, status: "approved"}}

    case "NAV_BACK": {
      if (s.phase === "boot" || s.phase === "clockIn") return s
      if (s.phase === "handover") return {...s,phase:"review",bodyView:"cow"}
      if (s.phase === "emergency") return endEmergency(s)
      const previous = PHASES[PHASES.indexOf(s.phase) - 1]
      return previous === "emergency" ? beginEmergency(s) : moveTo(s, previous, null)
    }

    case "NAV_NEXT": {
      if (s.phase === "boot" || s.phase === "handover") return s
      if (s.phase === "emergency") return endEmergency(s)
      if (s.phase === "clockIn" && s.bedId === null) return s
      const next = PHASES[PHASES.indexOf(s.phase) + 1]
      return next === "emergency" ? beginEmergency(s) : moveTo(s, next, null)
    }

    case "PRIVACY_ON":
      if (s.phase === "boot" || s.privacy) return s
      // Stopping capture discards the partial sample; nothing was transcribed.
      return {...s, privacy: true, capture: interrupt(s.capture)}

    case "PRIVACY_OFF":
      return s.privacy ? {...s, privacy: false} : s

    case "TOGGLE_MENU":
      return {...s, view: {...s.view, menuOpen: !s.view.menuOpen, pending: "none"}}

    case "REQUEST_SWITCH":
      if (!s.view.menuOpen || s.session !== "demo" || s.bedId === null || s.view.pending === "switch") return s
      return {...s, view: {...s.view, pending: "switch"}}

    case "REQUEST_RESET":
      if (!s.view.menuOpen || s.phase === "boot" || s.view.pending === "reset") return s
      return {...s, view: {...s.view, pending: "reset"}}

    case "CONFIRM_PENDING":
      if (s.view.pending === "reset") return createInitialState()
      if (s.view.pending === "switch") return {...clearEncounter(s), phase: "clockIn"}
      return s

    case "CANCEL_PENDING":
      return s.view.pending === "none" ? s : {...s, view: {...s.view, pending: "none"}}

    // Minimise only collapses the dashboard into the strip under the top HUD: a recording keeps running.
    case "MINIMISE":
      if (s.phase === "boot" || s.phase === "emergency" || s.view.minimised) return s
      return {...s, view: {...s.view, minimised: true}}

    // Walking away from the bed is different: the nurse is no longer with the patient, so capture stops.
    case "AWAY_FROM_BED":
      if (s.phase === "boot" || s.phase === "emergency" || s.view.minimised) return s
      return {...s, capture: interrupt(s.capture), view: {...s.view, minimised: true}}

    case "RESTORE":
    case "NEAR_BED":
      if (s.phase === "emergency" || !s.view.minimised) return s
      return {...s, view: {...s.view, minimised: false}}

    case "SET_MINI_CORNER":
      return s.view.miniCorner === event.corner ? s : {...s, view: {...s.view, miniCorner: event.corner}}

    default:
      return s
  }
}
