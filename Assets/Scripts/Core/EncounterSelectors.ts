// VitalLens selectors (docs/contracts/encounter-state.md). Each selector turns the
// state into plain display data for one passive UI module. Selectors never change
// state. A control is enabled exactly when the reducer would accept its event.
import * as Fx from "./EncounterFixtures"
import {canDispatch, isVerified, PHASES} from "./EncounterReducer"
import type {
  BedId,
  CardId,
  EncounterEvent,
  EncounterState,
  FlagId,
  HandoverStatus,
  IdentifierId,
  NoteStatus,
  NoteVersion,
  PatientId,
  PendingConfirm,
  Phase,
} from "./EncounterTypes"

export interface ControlView {
  readonly enabled: boolean
  /** Why the control is disabled, or null when enabled. */
  readonly reason: string | null
}

export type Tone = "neutral" | "caution" | "verified" | "emergency" | "system"

const CONFIRM_FIRST = "Confirm the patient first"

const PHASE_LABELS: {readonly [K in Phase]: string} = {
  boot: "Boot",
  clockIn: "Clock in",
  identify: "Identify",
  round: "Routine round",
  review: "Review draft",
  emergency: "Emergency",
  handover: "Handover",
}

const STATUS_LABELS: {readonly [K in NoteStatus]: string} = {
  draft: "Draft, not saved",
  edited: "Edited, not saved",
  pendingReview: Fx.LABELS.savedForReview,
  rejected: "Rejected",
}

function control(s: EncounterState, event: EncounterEvent, reasonIfRefused: string | null): ControlView {
  const enabled = canDispatch(s, event)
  return {enabled, reason: enabled ? null : reasonIfRefused ?? "Not available now"}
}

function patientId(s: EncounterState): PatientId | null {
  return isVerified(s) ? s.scannedPatientId : null
}

function encounterVisible(s: EncounterState): boolean {
  return isVerified(s) && !s.privacy
}

function siteText(note: NoteVersion, flagId: FlagId, pid: PatientId | null = "pt-target"): string {
  const fixture = Fx.flagFixture(flagId,pid)
  const flag = note.flags.find((f) => f.flagId === flagId)
  const optionId = flag && flag.resolution !== null ? flag.resolution : fixture.drafted
  const option = fixture.options.find((o) => o.id === optionId)
  return option ? option.text : Fx.UNKNOWN
}

function noteLines(note: NoteVersion, pid: PatientId | null): string[] {
  return Fx.draftTemplateFor(pid).map((line) => line.replace("{site}", siteText(note, "site",pid)))
}

// ---------------------------------------------------------------- identity

export interface IdentityChipView {
  readonly text: string
  readonly tone: Tone
}

function identityChip(s: EncounterState): IdentityChipView {
  if (s.bedId === null) return {text: "No patient", tone: "neutral"}
  if (s.privacy) return {text: "Patient hidden", tone: "neutral"}
  if (s.verification === "mismatch") return {text: "ID mismatch, stop", tone: "emergency"}
  if (s.verification === "verified" && s.scannedPatientId !== null) {
    return {text: Fx.PATIENTS[s.scannedPatientId].initials + " · Verified", tone: "verified"}
  }
  return {text: "Not confirmed", tone: "caution"}
}

export interface IdentifierRowView {
  readonly identifier: IdentifierId
  readonly label: string
  readonly assignment: string
  /** null until the wristband has been scanned. */
  readonly wristband: string | null
  readonly confirmed: boolean
  readonly confirm: ControlView
}

export function selectIdentity(s: EncounterState) {
  const chip = identityChip(s)
  const bed = s.bedId !== null ? Fx.assignmentFor(s.bedId) : null
  const assigned = bed ? Fx.PATIENTS[bed.patientId] : null
  const scanned = s.scannedPatientId !== null ? Fx.PATIENTS[s.scannedPatientId] : null
  const mismatch = s.verification === "mismatch"
  const rows: IdentifierRowView[] = assigned
    ? [
        {
          identifier: "name",
          label: "Name",
          assignment: assigned.fullName,
          wristband: scanned ? scanned.fullName : null,
          confirmed: s.confirmed.name,
          confirm: control(s, {type: "CONFIRM_IDENTIFIER", identifier: "name"}, mismatch ? "ID mismatch" : "Scan the wristband first"),
        },
        {
          identifier: "dob",
          label: "Date of birth",
          assignment: assigned.dob,
          wristband: scanned ? scanned.dob : null,
          confirmed: s.confirmed.dob,
          confirm: control(s, {type: "CONFIRM_IDENTIFIER", identifier: "dob"}, mismatch ? "ID mismatch" : "Scan the wristband first"),
        },
      ]
    : []
  const verified = isVerified(s)
  const encounterPhase = s.phase !== "boot" && s.phase !== "clockIn"
  return {
    chip,
    verifiedSummary:
      verified && !s.privacy && scanned && bed
        ? `${scanned.fullName}, ${scanned.age}, ${bed.bedLabel}, ✓ 2 identifiers`
        : null,
    // Emergency has its own single-scan gate (owner round 2, 9b).
    gateVisible:
      s.bedId !== null && !s.privacy && s.phase !== "emergency" && (s.phase === "identify" || (encounterPhase && !verified)),
    wristbandVisible: s.bedId !== null && !s.privacy && s.phase === "identify",
    bedLabel: bed ? bed.bedLabel : null,
    rows,
    mismatch,
    mismatchMessage: mismatch ? "ID mismatch, stop. Wristband does not match this bed's assignment." : null,
    blockedReason: encounterPhase && !verified ? CONFIRM_FIRST : null,
    scanLabel: Fx.LABELS.scanWristband,
    scanMismatchLabel: Fx.LABELS.scanMismatch,
    scan: control(s, {type: "SCAN_WRISTBAND", wristband: "assigned"}, "Choose a bed in Identify first"),
    scanMismatch: control(s, {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"}, "Choose a bed in Identify first"),
    doesntMatch: control(s, {type: "MARK_MISMATCH"}, null),
    rescan: control(s, {type: "RESCAN"}, null),
    backToBrief: control(s, {type: "BACK_TO_BRIEF"}, null),
  }
}

// ---------------------------------------------------------------- ward

function wardCounts() {
  let obsDue = 0
  let medsDue = 0
  let fallRisk = 0
  for (const bed of Fx.WARD) {
    if (bed.needs.some((n) => n.kind === "obs")) obsDue++
    if (bed.needs.some((n) => n.kind === "meds")) medsDue++
    if (bed.needs.some((n) => n.kind === "fallRisk")) fallRisk++
  }
  return {assigned: Fx.WARD.length, obsDue, medsDue, fallRisk}
}

/**
 * The earliest timed ward need, as "Bed 2, meds 09:30" (storyboard nextNeed()).
 * The bed whose patient is verified is left out: its care is already in front of the nurse.
 */
function nextWardNeedText(s: EncounterState): string | null {
  const skip = isVerified(s) ? s.bedId : null
  let best: {bed: string; label: string; time: string} | null = null
  for (const bed of Fx.WARD) {
    if (bed.bedId === skip) continue
    for (const need of bed.needs) {
      if (need.time !== null && (best === null || need.time < best.time)) {
        best = {bed: bed.bedLabel, label: need.kind === "obs" ? "obs" : "meds", time: need.time}
      }
    }
  }
  return best ? `${best.bed}, ${best.label} ${best.time}` : null
}

function nextWardNeed(s: EncounterState): string | null {
  const t = nextWardNeedText(s)
  return t ? "Next: " + t : null
}

export type StripIdState = "none" | "ok" | "bad"

const STRIP_ID_TEXT: {readonly [K in StripIdState]: string} = {
  none: "Not verified",
  ok: "Verified",
  bad: "ID mismatch, stop",
}

/** Short mode names for the always-on strip (storyboard STRIP_MODE, mapped onto this prototype's phases). */
const STRIP_MODE: {readonly [K in Phase]: string} = {
  boot: "Start",
  clockIn: "Shift",
  identify: "Verify",
  round: "Overview",
  review: "Note",
  emergency: "Code Blue drill",
  handover: "Handover",
}

/** The always-on top strip (storyboard view 1 and the strip rules). */
function strip(s: EncounterState) {
  const chosen = s.bedId !== null && s.phase !== "clockIn" && s.phase !== "boot"
  const bed = chosen && s.bedId !== null ? Fx.assignmentFor(s.bedId) : null
  const emergency = s.phase === "emergency"
  const patient = emergency
    ? `Emergency · ${bed ? bed.bedLabel : "bed"}`
    : !bed
      ? "No patient"
      : s.privacy
        ? "Patient hidden"
        : `${Fx.PATIENTS[bed.patientId].shortName} · ${bed.bedLabel}`
  const idState: StripIdState | null =
    !bed || s.privacy || emergency
      ? null
      : s.verification === "mismatch"
        ? "bad"
        : s.verification === "verified"
          ? "ok"
          : "none"
  const need = s.privacy ? "Ward details hidden" : (nextWardNeedText(s) ?? "No timed needs")
  return {
    patient,
    idState,
    idText: idState ? STRIP_ID_TEXT[idState] : null,
    mode: `${STRIP_MODE[s.phase]} · ${Fx.DEMO_TIME}`,
    nextLabel: "Next",
    need,
    rec: s.capture === "recording",
  }
}

export function selectWardFlags(s: EncounterState) {
  const walking = s.view.minimised && s.phase !== "boot"
  const demo = s.session === "demo"
  return {
    sessionLabel: Fx.LABELS.demoSession,
    briefVisible: demo && s.phase === "clockIn" && !s.privacy && !s.view.minimised,
    flagsVisible: demo && s.phase !== "emergency" && !s.privacy && (s.phase === "clockIn" || walking),
    /** Bed flags: bed number and needs only. No names, initials or photos. */
    flags: Fx.WARD.map((bed) => ({
      bedId: bed.bedId,
      bedLabel: bed.bedLabel,
      needs: bed.needs.slice(0, 3).map((n) => n.label),
      selected: s.bedId === bed.bedId,
    })),
    /** Shift overview header (storyboard view 1). */
    header: Fx.SHIFT,
    /** Shift overview rows: number, short name, one line, time; the routine bed is highlighted. */
    brief: Fx.WARD.map((bed) => ({
      bedId: bed.bedId as BedId,
      bedLabel: bed.bedLabel,
      bedNumber: bed.bedNumber,
      initials: Fx.PATIENTS[bed.patientId].initials,
      name: Fx.PATIENTS[bed.patientId].shortName,
      row: bed.row,
      due: bed.due,
      highlighted: bed.bedId === Fx.ROUTINE_BED_ID,
      needs: bed.needs.slice(0, 3).map((n) => n.label),
      select: control(s, {type: "SELECT_BED", bedId: bed.bedId}, "Switch patient first"),
    })),
    counts: wardCounts(),
    /** The three counters the shift overview shows (storyboard: Assigned, Obs due, Meds due). */
    counters: (() => {
      const k = wardCounts()
      return [
        {label: "Assigned", value: k.assigned},
        {label: "Obs due", value: k.obsDue},
        {label: "Meds due", value: k.medsDue},
      ]
    })(),
    nextNeed: nextWardNeed(s),
  }
}

// ---------------------------------------------------------------- status rail

const SWITCH_CLEARS: readonly string[] = [
  "Patient identification",
  "Consent and capture",
  "Sample transcript",
  "Note drafts and approvals",
  "Handover",
  "Open windows",
]

export function selectStatusRail(s: EncounterState) {
  const emergency = s.phase === "emergency"
  const pending: PendingConfirm = s.view.pending
  return {
    simulatedLabel: Fx.LABELS.simulated,
    mode: emergency ? ("emergency" as const) : ("routine" as const),
    modeLabel: emergency ? "Emergency mode" : "Routine mode",
    phases: PHASES.map((p) => ({id: p, label: PHASE_LABELS[p], current: p === s.phase})),
    phaseLabel: PHASE_LABELS[s.phase],
    identity: identityChip(s),
    /** Name, age and bed once verified (privacy hides it); null otherwise. */
    patientLine:
      isVerified(s) && !s.privacy && s.scannedPatientId !== null && s.bedId !== null
        ? `${Fx.PATIENTS[s.scannedPatientId].fullName}, ${Fx.PATIENTS[s.scannedPatientId].age} · ${Fx.assignmentFor(s.bedId).bedLabel}`
        : null,
    demoTime: Fx.DEMO_TIME,
    recVisible: s.capture === "recording",
    recLabel: Fx.LABELS.rec,
    privacyOn: s.privacy,
    captureInterrupted: s.capture === "interrupted",
    minimised: s.view.minimised,
    miniCorner: s.view.miniCorner,
    nextWardNeed: s.session === "demo" ? nextWardNeed(s) : null,
    /** The always-on two-row strip (redesign Slice 1). */
    strip: strip(s),
    menu: {
      open: s.view.menuOpen,
      pending,
      pendingMessage:
        pending === "switch"
          ? "Switch patient? This clears:"
          : pending === "reset"
            ? "Reset the demo? Every value returns to the start."
            : null,
      clears: pending === "switch" ? SWITCH_CLEARS : [],
      switchPatient: control(s, {type: "REQUEST_SWITCH"}, "No patient to switch from"),
      resetDemo: control(s, {type: "REQUEST_RESET"}, null),
      confirm: control(s, {type: "CONFIRM_PENDING"}, null),
      cancel: control(s, {type: "CANCEL_PENDING"}, null),
    },
  }
}

// ---------------------------------------------------------------- dock

export function selectDock(s: EncounterState) {
  const emergency = s.phase === "emergency"
  return {
    back: {label: "Back", ...control(s, {type: "NAV_BACK"}, null)},
    privacy: s.privacy
      ? {label: "End privacy", ...control(s, {type: "PRIVACY_OFF"}, null)}
      : {label: "Privacy", ...control(s, {type: "PRIVACY_ON"}, "Begin the demonstration first")},
    // While minimised the same control restores, so the nurse never needs a second button for it.
    minimise: s.view.minimised
      ? {label: "Restore", ...control(s, {type: "RESTORE"}, null)}
      : {label: "Minimise", ...control(s, {type: "MINIMISE"}, emergency ? "Not in Emergency mode" : null)},
    emergency: emergency
      ? {label: "Close emergency", ...control(s, {type: "CLOSE_EMERGENCY"}, null)}
      : {label: "Emergency", ...control(s, {type: "OPEN_EMERGENCY"}, "Clock in first")},
    next: {
      label: "Next",
      ...control(s, {type: "NAV_NEXT"}, s.phase === "boot" ? "Select Begin demonstration" : s.phase === "clockIn" ? "Choose a bed first" : null),
    },
  }
}

// ---------------------------------------------------------------- ring

export type RingMode = "powerUp" | "radar" | "identifiers" | "capture" | "note" | "emergency" | "handover" | "dimmed"

function noteStage(s: EncounterState): number {
  const note = s.note
  if (note === null || note.status === "rejected") return 0
  if (note.status === "pendingReview") return 3
  return note.flags.every((f) => f.resolution !== null) ? 2 : 1
}

export function selectRing(s: EncounterState) {
  const phaseIndex = PHASES.indexOf(s.phase)
  const base = {phaseIndex, phaseCount: PHASES.length}
  const identifiers = (s.confirmed.name ? 1 : 0) + (s.confirmed.dob ? 1 : 0)
  if (s.privacy) return {...base, mode: "dimmed" as RingMode, progress: null, label: "Privacy on", tone: "neutral" as Tone}
  switch (s.phase) {
    case "boot":
      return {...base, mode: "powerUp" as RingMode, progress: null, label: "VitaLens", tone: "system" as Tone}
    case "clockIn":
      return {...base, mode: "radar" as RingMode, progress: null, label: `${Fx.WARD.length} beds`, tone: "neutral" as Tone}
    case "emergency":
      return {...base, mode: "emergency" as RingMode, progress: null, label: "Emergency", tone: "emergency" as Tone}
    default:
      break
  }
  if (!isVerified(s)) {
    const mismatch = s.verification === "mismatch"
    return {
      ...base,
      mode: "identifiers" as RingMode,
      progress: mismatch ? null : {done: identifiers, total: 2},
      label: mismatch ? "ID mismatch" : `${identifiers}/2`,
      tone: "caution" as Tone,
    }
  }
  if (s.phase === "identify") {
    return {...base, mode: "identifiers" as RingMode, progress: {done: 2, total: 2}, label: "2/2", tone: "verified" as Tone}
  }
  if (s.phase === "round") {
    const recording = s.capture === "recording"
    return {
      ...base,
      mode: "capture" as RingMode,
      progress: null,
      label: recording ? "REC (sample)" : "Ready",
      tone: recording ? ("emergency" as Tone) : ("neutral" as Tone),
    }
  }
  if (s.phase === "review") {
    const stage = noteStage(s)
    return {
      ...base,
      mode: "note" as RingMode,
      progress: {done: stage, total: 3},
      label: s.note ? "v" + s.note.version : "No draft",
      tone: stage >= 3 ? ("verified" as Tone) : ("neutral" as Tone),
    }
  }
  const ho = s.handover
  const stale = ho !== null && ho.status === "stale"
  return {
    ...base,
    mode: "handover" as RingMode,
    progress: {done: ho === null || stale ? 0 : ho.status === "approved" ? 2 : 1, total: 2},
    label: ho === null ? "Not built" : stale ? "Stale" : ho.status === "approved" ? "Approved" : "Built",
    tone: stale ? ("caution" as Tone) : ho !== null && ho.status === "approved" ? ("verified" as Tone) : ("neutral" as Tone),
  }
}

// ---------------------------------------------------------------- record cards

export function selectRecordCards(s: EncounterState) {
  const pid = patientId(s)
  const visible = pid !== null && !s.privacy && (s.phase === "identify" || s.phase === "round")
  const lines = pid !== null ? Fx.summaryFor(pid) : []
  const open = visible && s.view.openCard !== null ? lines.find((l) => l.card === s.view.openCard) : undefined
  return {
    visible,
    blockedReason: pid === null && s.bedId !== null ? CONFIRM_FIRST : null,
    summary: visible
      ? lines.map((l) => ({
          card: l.card as CardId,
          label: l.label,
          value: l.value,
          source: l.source,
          time: l.time,
          open: control(s, {type: "OPEN_CARD", card: l.card}, s.phase === "round" ? null : "Go to Routine round to open cards"),
        }))
      : [],
    openCard: open
      ? {card: open.card, title: open.label, lines: open.details, source: open.source, time: open.time}
      : null,
    closeCard: control(s, {type: "CLOSE_CARD"}, null),
  }
}

// ---------------------------------------------------------------- capture

function captureMessage(s: EncounterState): string {
  if (s.consent === "declined") return "Consent declined. Nothing is captured."
  if (s.consent === "unasked") return "Ask the patient for consent before capture."
  switch (s.capture) {
    case "recording":
      return "REC (sample). " + Fx.LABELS.captureDisclosure
    case "stopped":
      return "Stopped. Sample transcript ready."
    case "interrupted":
      return "Interrupted. Start again to capture."
    default:
      return "Ready. Select Start capture."
  }
}

export function selectCapture(s: EncounterState) {
  const pid = patientId(s)
  const noSample = pid !== null && !Fx.hasSampleTranscript(pid)
  const startReason = !isVerified(s)
    ? CONFIRM_FIRST
    : noSample
      ? "No sample transcript for this patient. The demo covers Bed 3."
      : s.consent === "declined"
        ? "Consent declined"
        : s.consent !== "granted"
          ? "Record consent first"
          : s.privacy
            ? "Privacy is on"
            : null
  return {
    visible: encounterVisible(s) && s.phase === "round",
    consent: s.consent,
    capture: s.capture,
    statusMessage: captureMessage(s),
    disclosure: Fx.LABELS.captureDisclosure,
    recVisible: s.capture === "recording",
    grant: control(s, {type: "GRANT_CONSENT"}, null),
    decline: control(s, {type: "DECLINE_CONSENT"}, null),
    askAgain: control(s, {type: "RESET_CONSENT"}, null),
    start: control(s, {type: "START_CAPTURE"}, startReason),
    stop: control(s, {type: "STOP_CAPTURE"}, null),
    draft: control(s, {type: "GENERATE_DRAFT"}, s.consent === "declined" ? "Consent declined" : "Stop a sample capture first"),
    transcript: s.transcript === "sample" && encounterVisible(s) ? {label: Fx.LABELS.sampleTranscript, lines: Fx.transcriptFor(s.scannedPatientId)} : null,
  }
}

// ---------------------------------------------------------------- draft

function saveReason(s: EncounterState): string | null {
  const note = s.note
  if (!isVerified(s)) return CONFIRM_FIRST
  if (note === null) return "No draft yet"
  if (note.status === "pendingReview") return "Already saved for COW review"
  if (note.status === "rejected") return "Draft rejected"
  if (!note.flags.every((f) => f.resolution !== null)) return "Resolve flagged items first"
  return null
}

export function selectDraft(s: EncounterState) {
  const note = s.note
  const openFlag = s.view.openFlag
  const pickFixture = note !== null && openFlag !== null ? Fx.flagFixture(openFlag,s.scannedPatientId) : null
  return {
    visible: encounterVisible(s) && s.phase === "review",
    label: Fx.LABELS.draft,
    exists: note !== null,
    emptyMessage: note === null ? "No draft yet" : null,
    version: note ? note.version : null,
    status: note ? note.status : null,
    statusLabel: note ? STATUS_LABELS[note.status] : null,
    lines: note ? noteLines(note,s.scannedPatientId) : [],
    flags: note
      ? note.flags.map((f) => {
          const fx = Fx.flagFixture(f.flagId,s.scannedPatientId)
          const chosen = f.resolution !== null ? fx.options.find((o) => o.id === f.resolution) : undefined
          return {
            id: f.flagId,
            label: fx.label,
            evidence: fx.evidence,
            resolved: f.resolution !== null,
            resolutionLabel: chosen ? chosen.label : null,
            open: control(s, {type: "OPEN_FLAG", flagId: f.flagId}, null),
          }
        })
      : [],
    pickList: pickFixture
      ? {
          flagId: pickFixture.id,
          title: pickFixture.label,
          options: pickFixture.options.map((o) => ({
            id: o.id,
            label: o.label,
            choose: control(s, {type: "CORRECT_DRAFT", flagId: pickFixture.id, optionId: o.id}, null),
          })),
          close: control(s, {type: "CLOSE_FLAG"}, null),
        }
      : null,
    saveLabel: Fx.LABELS.saveForReview,
    /** The only control that changes a draft's status to pending review. Never signs or files. */
    save: (() => {
      const enabled = canDispatch(s, {type: "SAVE_FOR_REVIEW"})
      return {enabled, reason: enabled ? null : saveReason(s)}
    })(),
    saved: note !== null && note.status === "pendingReview",
    reject: control(s, {type: "REJECT_DRAFT"}, null),
    newCapture: control(s, {type: "NEW_CAPTURE"}, null),
    amend: control(s, {type: "AMEND_NOTE"}, null),
    history: s.noteHistory.map((h) => ({
      version: h.version,
      statusLabel: h.outcome === "rejected" ? "Rejected" : "Superseded",
    })),
  }
}

// ---------------------------------------------------------------- emergency

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const m = Math.floor(whole / 60)
  const sec = whole % 60
  return `${m < 10 ? "0" : ""}${m}:${sec < 10 ? "0" : ""}${sec}`
}

/** The playback frame in force at this drill second (the last frame holds). */
export function playbackFrame(drillSeconds: number) {
  let frame = Fx.EMERGENCY_PLAYBACK[0]
  for (const f of Fx.EMERGENCY_PLAYBACK) if (f.at <= drillSeconds) frame = f
  return frame
}

/**
 * Emergency view. `drillSeconds` is the view-only drill clock from the main script; it is
 * never stored, and the same second always gives the same values (owner round 2, D1).
 */
export function selectEmergency(s: EncounterState, drillSeconds: number = 0) {
  const active = s.phase === "emergency"
  const pid = active ? s.emergencyPatientId : null
  const target = pid === "pt-target"
  const bed =
    isVerified(s) && s.bedId !== null
      ? Fx.assignmentFor(s.bedId)
      : pid !== null
        ? Fx.WARD.find((b) => b.wristbandPatientId === pid) ?? null
        : null
  const frame = playbackFrame(drillSeconds)
  const playbackTime = "Drill +" + clock(frame.at)
  return {
    active,
    showGate: false,
    visible: active && pid !== null && !s.privacy,
    banner: active && pid !== null ? (target ? Fx.EMERGENCY.banner : `Code blue, ${bed ? bed.bedLabel : "bed"} (simulated drill)`) : null,
    readOnlyNotice: Fx.LABELS.emergencyReadOnly,
    scanLabel: Fx.LABELS.scanWristband,
    scan: control(s, {type: "EMERGENCY_SCAN"}, null),
    drillTimer: `Drill timer ${clock(drillSeconds)}, not saved`,
    callDoctorLabel: Fx.LABELS.callDoctor,
    callDoctorNotice: Fx.LABELS.callDoctorNotice,
    cards: Fx.EMERGENCY.cards.map((c) =>
      target ? {...c} : {id: c.id, label: c.label, value: Fx.UNKNOWN, source: null, time: null},
    ),
    vitalsLabel: Fx.LABELS.sampleVitals,
    liveNotice: Fx.LABELS.playback,
    vitals: Fx.EMERGENCY.vitals.map((v) => {
      const played = v.id === "hr" ? frame.hr : v.id === "spo2" ? frame.spo2 : null
      const value = played ?? v.value
      const known = target && (value !== null || v.text !== null)
      const display = known ? (value !== null ? `${value}` : (v.text as string)) : Fx.UNKNOWN
      const abnormal = known && value !== null && v.normal !== null && (value < v.normal.min || value > v.normal.max)
      return {
        id: v.id,
        label: v.label,
        display,
        unit: known ? v.unit : "",
        abnormal,
        source: known ? (played !== null ? "Simulated playback" : v.source) : null,
        time: known ? (played !== null ? playbackTime : v.time) : null,
      }
    }),
  }
}

// ---------------------------------------------------------------- handover

export type IsbarSection = "Identify" | "Situation" | "Background" | "Assessment" | "Recommendation"

export interface IsbarLine {
  readonly section: IsbarSection
  readonly text: string
  readonly source: string
}

function isbarLines(s: EncounterState, source: NoteVersion): IsbarLine[] {
  const pid = s.scannedPatientId
  if (pid === null || s.bedId === null) return []
  const patient = Fx.PATIENTS[pid]
  const bed = Fx.assignmentFor(s.bedId)
  const note = `Note v${source.version} (pending COW review)`
  const lines: IsbarLine[] = [
    {section: "Identify", text: `${patient.fullName}, ${patient.age}, ${bed.bedLabel}`, source: "Wristband check, 2 identifiers"},
    {section: "Situation", text: `Wound check, ${siteText(source, "site",pid)}: dressing dry and intact.`, source: note},
    {section: "Background", text: pid === "pt-bed2" ? "Right knee replacement · day 2. Allergy: None." : "#NOF right, post-fall. Atrial fibrillation, on warfarin. Penicillin anaphylaxis.", source: "Record: diagnosis, medications, allergy"},
    {section: "Assessment", text: pid === "pt-bed2" ? "Pain 3 out of 10." : "Pain 4 out of 10.", source: note},
    {section: "Assessment", text: "Code status: Full code", source: "Record: code status"},
    {section: "Recommendation", text: pid === "pt-bed2" ? "Assist ×1. Obs due 10:30." : "Assist x1 (high fall risk). Obs due 10:00.", source: "Record: alerts, obs schedule"},
  ]
  // A line without a source is never shown (P7.2).
  return lines.filter((l) => l.source.length > 0)
}

function handoverMessage(status: HandoverStatus | "none"): string {
  switch (status) {
    case "built":
      return "Review, then slide to approve the handover."
    case "stale":
      return "Stale: a source changed. Rebuild before approval."
    case "approved":
      return "Handover approved. Not sent (simulated)."
    default:
      return "Build from the saved note."
  }
}

export function selectHandover(s: EncounterState) {
  const ho = s.handover
  const status: HandoverStatus | "none" = ho ? ho.status : "none"
  const note = s.note
  const buildReason = !isVerified(s)
    ? CONFIRM_FIRST
    : note === null || note.status !== "pendingReview"
      ? "No saved note"
      : "Already built from this version"
  return {
    visible: encounterVisible(s) && s.phase === "handover",
    label: Fx.LABELS.handover,
    status,
    sourceVersion: ho ? ho.source.version : null,
    build: {
      label: ho ? Fx.LABELS.rebuildHandover : Fx.LABELS.buildHandover,
      ...control(s, {type: "BUILD_HANDOVER"}, buildReason),
    },
    lines: ho ? isbarLines(s, ho.source) : [],
    tasks: ho ? Fx.handoverTasksFor(s.scannedPatientId).map((t) => ({id: t.id, text: t.text, owner: t.owner, status: "Pending" as const})) : [],
    message: handoverMessage(status),
    approve: control(
      s,
      {type: "APPROVE_HANDOVER"},
      status === "stale" ? "Rebuild before approval" : status === "none" ? "Build the handover first" : null,
    ),
  }
}
