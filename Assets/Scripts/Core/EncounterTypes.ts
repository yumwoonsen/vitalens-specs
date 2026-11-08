// VitalLens encounter state contract (docs/contracts/encounter-state.md).
//
// Pure TypeScript with no Lens Studio globals, so the same file runs in Lens
// Studio and in the Node tests under tests/core/. String-literal unions only
// (no enums), and type-only exports, so Node type stripping can load it.
// Everything described here is a fictional, simulated demonstration.

export type Phase = "boot" | "clockIn" | "identify" | "round" | "review" | "emergency" | "handover"

export type Session = "none" | "demo"
export type BedId = "bed1" | "bed2" | "bed3" | "bed4"
export type PatientId = "pt-target" | "pt-mismatch" | "pt-bed1" | "pt-bed2" | "pt-bed4"
export type IdentifierId = "name" | "dob"
export type WristbandChoice = "assigned" | "mismatchDemo"
export type Verification = "idle" | "scanned" | "mismatch" | "verified"
export type Consent = "unasked" | "granted" | "declined"
export type Capture = "idle" | "recording" | "stopped" | "interrupted"
export type Transcript = "none" | "sample"
/** pendingReview: saved for review on the COW. The glasses never sign or file. */
export type NoteStatus = "draft" | "edited" | "pendingReview" | "rejected"
export type HandoverStatus = "built" | "stale" | "approved"
export type PendingConfirm = "none" | "switch" | "reset"
export type MiniCorner = "left" | "right"
export type CardId = "diagnosis" | "allergy" | "medication" | "alert" | "diet" | "obs" | "vitals"
export type FlagId = "site"

export interface DraftFlagState {
  readonly flagId: FlagId
  /** Pick-list option id chosen by the nurse, or null while unresolved. */
  readonly resolution: string | null
}

export interface NoteVersion {
  readonly version: number
  readonly status: NoteStatus
  readonly flags: readonly DraftFlagState[]
}

export interface NoteHistoryEntry extends NoteVersion {
  /** superseded: a later version replaced it. rejected: the nurse rejected it. */
  readonly outcome: "superseded" | "rejected"
}

export interface HandoverState {
  readonly status: HandoverStatus
  /** Snapshot of the saved (pending review) note version the handover was built from. */
  readonly source: NoteVersion
}

export interface ViewState {
  readonly openCard: CardId | null
  readonly openFlag: FlagId | null
  readonly menuOpen: boolean
  readonly pending: PendingConfirm
  readonly minimised: boolean
  readonly miniCorner: MiniCorner
}

export interface InterruptedWork {
  readonly transcript: Transcript
  readonly note: NoteVersion | null
  readonly noteHistory: readonly NoteHistoryEntry[]
  readonly handover: HandoverState | null
}
export type BodyView = "overview" | "care" | "note" | "cow"
export interface EncounterState {
  readonly bodyView: BodyView
  readonly interruptedWork: Partial<Record<PatientId, InterruptedWork>>
  readonly emergencyBand: "none" | "matched" | "mismatch"
  readonly emergencyNear: boolean
  readonly emergencyContact: boolean
  readonly emergencyBrief: boolean
  readonly downstream: readonly {patientId: PatientId; version: number; stage: "signed" | "received"}[]

  /** Always true. Boot shows the "Simulated" disclosure; simulated capabilities carry a tag. */
  readonly simulated: true
  readonly phase: Phase
  /** Phase to return to when the emergency view closes. */
  readonly returnPhase: Phase | null
  readonly session: Session
  readonly bedId: BedId | null
  readonly verification: Verification
  readonly confirmed: {readonly name: boolean; readonly dob: boolean}
  readonly scannedPatientId: PatientId | null
  readonly consent: Consent
  readonly capture: Capture
  readonly privacy: boolean
  readonly transcript: Transcript
  /** Current note version, or null when no draft exists. */
  readonly note: NoteVersion | null
  /** Earlier versions of the current encounter's note, oldest first. */
  readonly noteHistory: readonly NoteHistoryEntry[]
  readonly handover: HandoverState | null
  /**
   * Patient read by the single emergency wristband scan (owner round 2, 9b), or null.
   * Read-only access: it never verifies the encounter. Cleared when the emergency view closes.
   */
  readonly emergencyPatientId: PatientId | null
  readonly view: ViewState
}

/** Events. UI modules emit these; only reduce() changes state. */
export type EncounterEvent =
  | {readonly type: "OPEN_HANDOVER" | "OPEN_OVERVIEW" | "OPEN_CARE" | "OPEN_NOTE" | "OPEN_COW" | "REOPEN_WORK" | "EMERGENCY_CONTACT" | "EMERGENCY_BRIEF" | "EMERGENCY_CLOSE_BRIEF" | "EMERGENCY_WRONG_BAND" | "EMERGENCY_NEAR" | "EMERGENCY_AWAY" | "COW_SIGN" | "EHR_RECEIVE"}
  | {readonly type: "RESET"}
  | {readonly type: "TICK"}
  | {readonly type: "START_DEMO"}
  | {readonly type: "CLOCK_IN"}
  | {readonly type: "SELECT_BED"; readonly bedId: BedId}
  | {readonly type: "SCAN_WRISTBAND"; readonly wristband: WristbandChoice}
  | {readonly type: "CONFIRM_IDENTIFIER"; readonly identifier: IdentifierId}
  | {readonly type: "MARK_MISMATCH"}
  | {readonly type: "RESCAN"}
  | {readonly type: "BACK_TO_BRIEF"}
  | {readonly type: "OPEN_CARD"; readonly card: CardId}
  | {readonly type: "CLOSE_CARD"}
  | {readonly type: "GRANT_CONSENT"}
  | {readonly type: "DECLINE_CONSENT"}
  | {readonly type: "RESET_CONSENT"}
  | {readonly type: "START_CAPTURE"}
  | {readonly type: "STOP_CAPTURE"}
  | {readonly type: "GENERATE_DRAFT"}
  | {readonly type: "OPEN_FLAG"; readonly flagId: FlagId}
  | {readonly type: "CORRECT_DRAFT"; readonly flagId: FlagId; readonly optionId: string}
  | {readonly type: "CLOSE_FLAG"}
  | {readonly type: "REJECT_DRAFT"}
  | {readonly type: "NEW_CAPTURE"}
  | {readonly type: "SAVE_FOR_REVIEW"}
  | {readonly type: "AMEND_NOTE"}
  | {readonly type: "OPEN_EMERGENCY"}
  | {readonly type: "CLOSE_EMERGENCY"}
  | {readonly type: "EMERGENCY_SCAN"}
  | {readonly type: "BUILD_HANDOVER"}
  | {readonly type: "APPROVE_HANDOVER"}
  | {readonly type: "NAV_BACK"}
  | {readonly type: "NAV_NEXT"}
  | {readonly type: "PRIVACY_ON"}
  | {readonly type: "PRIVACY_OFF"}
  | {readonly type: "TOGGLE_MENU"}
  | {readonly type: "REQUEST_SWITCH"}
  | {readonly type: "REQUEST_RESET"}
  | {readonly type: "CONFIRM_PENDING"}
  | {readonly type: "CANCEL_PENDING"}
  | {readonly type: "MINIMISE"}
  | {readonly type: "RESTORE"}
  | {readonly type: "SET_MINI_CORNER"; readonly corner: MiniCorner}
  | {readonly type: "AWAY_FROM_BED"}
  | {readonly type: "NEAR_BED"}

export type EncounterEventType = EncounterEvent["type"]
