// VitalLens Scenario 2 screens (docs/design/lens-spec.json, s2-*): patient overview, care
// details and the note flow. selectPatientScreen projects the encounter state; PatientBody
// draws it inside the shared chrome and only emits encounter events. Patient facts come
// from Core and its fixtures; fixed wording is the storyboard's. Spec measurements, in cm
// from the panel's top-left corner, go through cm() (UI_SCALE). Text and 4 cm buttons keep
// their floors, so stages are taller than the plain scaled height by what those add.
//
// The font has no ₂, ○, ● or ✓, so these are drawn as a small "2", shapes and an icon.
import * as Fx from "./Core/EncounterFixtures"
import {selectCards} from "./Core/CardPresentation"
import {canDispatch, isVerified} from "./Core/EncounterReducer"
import * as Sel from "./Core/EncounterSelectors"
import type {EncounterEvent, EncounterState} from "./Core/EncounterTypes"
import type {CaptionFrame} from "./Core/LiveCaptions"
import {box, Box, cm, fontCm, hex, icon, label, obj, placeBox, placeLabel, setBorder, setSolidEnabled, setText, show, solidButton, SolidButton} from "./VitaLensSharedUI"

export type PatientStage = "overview" | "care" | "reopen" | "consent" | "declined" | "ready" | "recording" | "draft" | "corrected" | "saved" | "cow" | "privacy"


const X = cm(0.88)
const W = cm(38.23)
const R = X + W
const HALF_W = cm(18.72)
const HALF_X2 = cm(20.4)
const BTN_H = 4
const ICON = cm(2.2)
const ICON_Y = (BTN_H - ICON) / 2
const ICON_GAP = 0.4
const BTN_GAP = cm(0.8)
const END_GAP = cm(1.2)
const BAR_H = cm(6.88)
const QUIET = "The glasses have not signed or filed this note."
const QUIET_H = 1.4
const LINE_PITCH = 1.7
const LINE_H = 1.6
const NAME_FONT = fontCm(1.8)
const CHAR_W_NAME = 0.57 * NAME_FONT

// Shared top of the body.
const NAME_Y = cm(7.28)
const BED_Y = cm(9.5)
const PILL_Y = cm(7.28)
/** The small "Verified" pill; the verified wristband screen uses the same one. */
export const VERIFIED_PILL = {w: 8.14, h: cm(3.2), icon: cm(1.8), font: 1.4, inset: 0.7, iconGap: 0.3, end: 0.5}
const PILL_H = VERIFIED_PILL.h
const PILL_ICON = VERIFIED_PILL.icon
const PILL_W_VERIFIED = VERIFIED_PILL.w
const PILL_W_SAVED = cm(6.36)
const PILL_W_VERSION = cm(3.96)
const BODY_Y = cm(12.23)
const HEADING_H = 2

// The allergy box has one gap above and below it, measured to the visible text: the bed
// line's baseline above, the capitals of the next line below. Cap height is about 0.35 em
// either side of a line's centre.
const SECTION_GAP = cm(1.2)
const CAP = 0.35
const ALLERGY_Y = BED_Y + 0.7 + CAP * 1.17 + SECTION_GAP
const ALLERGY_H = cm(2.35)
const BELOW_ALLERGY = ALLERGY_Y + ALLERGY_H + SECTION_GAP
const DIAGNOSIS_H = 1.7
const DIAGNOSIS_Y = BELOW_ALLERGY + CAP * 1.4 - DIAGNOSIS_H / 2
const CARE_TITLE_Y = BELOW_ALLERGY + CAP * 1.6 - HEADING_H / 2
/** How far the diagnosis moved down; the rest of the overview follows it. */
const OVERVIEW_GROW = DIAGNOSIS_Y + DIAGNOSIS_H / 2 - (cm(14.98) + cm(1.68) / 2)

// Overview. The vitals need 3.3 cm a row at their text size, so everything below moves down.
const OBS_GROW = 1
const OBS_TITLE_Y = cm(17.86) + OVERVIEW_GROW
const VITAL_Y = cm(19.76) + OVERVIEW_GROW
const VITAL_PITCH = cm(3.49) + OBS_GROW / 2
const VITAL_COLS = [X, cm(13.7), cm(26.5)]
const VITAL_VALUE_DY = 1.3
const DUE_Y = cm(27.93) + OBS_GROW + OVERVIEW_GROW
const OVERVIEW_BTN_Y = cm(33.72) + OBS_GROW + OVERVIEW_GROW

// The card around the note and the care rows. Deliberate deviation from the storyboard:
// its measurements are literal cm, like the text sizes, and panels grow downwards to fit
// it; the top edge stays where it was.
const CARD_PAD = 1
const CARD_RADIUS = 1.2
const CARD_GAP = cm(0.6)
const INNER_X = X + CARD_PAD
const INNER_W = W - 2 * CARD_PAD

// Care.
const CARE_Y = cm(18.38)
const CARE_PITCH = cm(3.92)
const CARE_CARD_H = 3 * CARE_PITCH + 3.12 + 2 * CARD_PAD
const CARE_BTN_Y = cm(36.72) + 2 * CARD_PAD

// Note flow.
const CONSENT_Y = cm(17.18)
const DECLINE_Y = CONSENT_Y + BTN_H + BTN_GAP
const CONSENT_QUIET_Y = DECLINE_Y + BTN_H + BTN_GAP
const CAPTURE_Y = cm(19.18)
const CAPTURE_QUIET_Y = CAPTURE_Y + BTN_H + BTN_GAP

// Live captions while REC is on (simulated sample conversation, preview only). The card sits between the
// status line and Stop; Stop and the quiet line move down by its height. The longest line, Mr Hakim's,
// takes three lines at this width, and a fourth is kept so the card never changes height mid-recording.
const CAP_CARD_Y = cm(14.99) + 1.4 + CARD_GAP
const CAP_HEAD_Y = CAP_CARD_Y + CARD_PAD
const CAP_PREV_Y = CAP_HEAD_Y + 1.4 + 0.3
const CAP_SPEAKER_Y = CAP_PREV_Y + 1.6 + 0.5
const CAP_TEXT_Y = CAP_SPEAKER_Y + 1.4
const CAP_LINES = 4
const CAP_CARD_H = CAP_TEXT_Y + CAP_LINES * LINE_PITCH + CARD_PAD - CAP_CARD_Y
const CAP_STOP_Y = CAP_CARD_Y + CAP_CARD_H + CARD_GAP
const CAP_QUIET_Y = CAP_STOP_Y + BTN_H + BTN_GAP
const HEIGHT_RECORDING_CAPTIONS = CAP_QUIET_Y + QUIET_H + BTN_GAP + BAR_H
const NOTE_HEAD_GAP = 0.3
const NOTE_CARD_H = 2 * CARD_PAD + PILL_H + NOTE_HEAD_GAP + 3 * LINE_PITCH + LINE_H
const DRAFT_NOTE_Y = BODY_Y + NOTE_CARD_H + CARD_GAP
const DRAFT_SAVE_Y = DRAFT_NOTE_Y + 1.4 + SECTION_GAP
const DRAFT_ROW_Y = DRAFT_SAVE_Y + BTN_H + BTN_GAP
const DRAFT_QUIET_Y = DRAFT_ROW_Y + BTN_H + BTN_GAP
const FIXED_REJECT_Y = DRAFT_SAVE_Y + BTN_H + BTN_GAP
const FIXED_QUIET_Y = FIXED_REJECT_Y + BTN_H + BTN_GAP
const SAVED_STATUS_H = 1.7
const SAVED_CARD_Y = BODY_Y + SAVED_STATUS_H + CARD_GAP
const SAVED_BTN_Y = SAVED_CARD_Y + NOTE_CARD_H + SECTION_GAP
const SAVED_QUIET_Y = SAVED_BTN_Y + BTN_H + BTN_GAP

// Reopen, COW and privacy. lens-spec.json has no states for these yet, so the measurements
// are the storyboard's (storyboard-redesign.html: nt-q, st-wrap, stl, bb-text).
const REOPEN_TEXT_Y = BODY_Y + HEADING_H + cm(0.4)
const REOPEN_TEXT_H = 3 * LINE_PITCH
const REOPEN_BTN_Y = REOPEN_TEXT_Y + REOPEN_TEXT_H + SECTION_GAP
const REOPEN_OVERVIEW_Y = REOPEN_BTN_Y + BTN_H + BTN_GAP
const COW_ROW_ICON = cm(2.6)
const COW_ROW_DOT = cm(1.1)
const COW_ROW_CHECK = cm(1.6)
const COW_TEXT_X = X + COW_ROW_ICON + cm(0.8)
const COW_TITLE_H = 1.7
const COW_DETAIL_H = 1.4
const COW_LIST_Y = BODY_Y + 1.4 + cm(1.2)
const COW_PITCH = COW_TITLE_H + COW_DETAIL_H + cm(1.2)
const COW_END_Y = COW_LIST_Y + 3 * COW_PITCH - cm(1.2)
const PRIVACY_TEXT_Y = NAME_Y + HEADING_H + cm(0.8)
const PRIVACY_TEXT_H = 1.7
// Storyboard wording: views 2 to 5 (full panel), and views 1 and 7 (compact panel, no patient chosen).
const PRIVACY_FULL = "Patient information hidden. Capture stopped."
const PRIVACY_COMPACT = "Privacy on. Patient information hidden. Capture stopped."

/** Panel height of each stage: where its body ends, the end gap and the bottom bar. */
const HEIGHT: {readonly [K in PatientStage]: number} = {
  overview: OVERVIEW_BTN_Y + BTN_H + END_GAP + BAR_H,
  care: CARE_BTN_Y + BTN_H + END_GAP + BAR_H,
  reopen: REOPEN_OVERVIEW_Y + BTN_H + END_GAP + BAR_H,
  cow: COW_END_Y + END_GAP + BAR_H,
  privacy: PRIVACY_TEXT_Y + PRIVACY_TEXT_H + END_GAP + BAR_H,
  consent: CONSENT_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  declined: CONSENT_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  ready: CAPTURE_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  recording: CAPTURE_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  draft: DRAFT_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  corrected: FIXED_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
  saved: SAVED_QUIET_Y + QUIET_H + BTN_GAP + BAR_H,
}

type ActionId = "startNote" | "openCare" | "toOverview" | "reopen" | "dismissReopen" | "consent" | "decline" | "start" | "stop" | "correct" | "save" | "reject" | "downstream"

export interface CowRow {
  readonly title: string
  readonly detail: string
  readonly step: "done" | "current" | "todo"
}

export interface PatientAction {
  readonly enabled: boolean
  /** Dispatched in order: the storyboard has one button where Core has two steps. */
  readonly events: readonly EncounterEvent[]
}

export interface PatientView {
  readonly stage: PatientStage
  readonly height: number
  /** Recording with the live-caption card: the panel keeps its full height from the start of REC. */
  readonly captionRoom: boolean
  readonly title: string
  readonly initials: string
  /** Progress step in the top bar. */
  readonly progress: number
  /** The storyboard enables Next only on these stages. */
  readonly next: boolean
  readonly stripMode: string
  readonly name: string
  readonly age: string
  readonly bedLine: string
  readonly allergy: string
  readonly diagnosis: string
  readonly vitals: readonly {label: string; display: string; unit: string}[]
  readonly medication: string
  readonly observations: string
  readonly task: string
  readonly mobility: string
  readonly diet: string
  readonly startLabel: string
  readonly statusLine: string
  readonly noteLines: readonly string[]
  readonly flaggedLine: number
  readonly evidence: string
  readonly correctLabel: string
  readonly version: string
  readonly reopenTitle: string
  readonly cowLine: string
  readonly cowRows: readonly CowRow[]
  readonly actions: {readonly [K in ActionId]: PatientAction}
  /** Privacy with no bed chosen (shift overview): the storyboard's compact privacy panel. */
  readonly noPatient: boolean
}

/** Everything on a privacy screen that could identify the patient: it is never in the view. */
const HIDDEN_PATIENT = {
  initials: "", name: "", age: "", bedLine: "", allergy: "", diagnosis: "", vitals: [], medication: "", observations: "", task: "", mobility: "", diet: "",
  noteLines: [], flaggedLine: -1, evidence: "", correctLabel: "", version: "", reopenTitle: "", cowLine: "", cowRows: [],
}

const ACTION_IDS: readonly ActionId[] = ["startNote", "openCare", "toOverview", "reopen", "dismissReopen", "consent", "decline", "start", "stop", "correct", "save", "reject", "downstream"]
const NO_ACTION: PatientAction = {enabled: false, events: []}

/**
 * The privacy screen, built from the state alone: no patient record, card or draft is read, so
 * nothing about the patient can reach it. Storyboard views 1 and 7 use the compact panel, views 2 to 5
 * the full one (storyboard-redesign.html, privacy branch).
 */
function privacyView(s: EncounterState): PatientView {
  // As the strip decides it (EncounterSelectors strip()): a bed counts once the shift view is left.
  const noPatient = s.bedId === null || s.phase === "clockIn" || s.phase === "boot"
  const actions = {} as {[K in ActionId]: PatientAction}
  for (const id of ACTION_IDS) actions[id] = NO_ACTION
  return {
    ...HIDDEN_PATIENT,
    stage: "privacy",
    height: HEIGHT.privacy + (noPatient ? PRIVACY_TEXT_H : 0),
    captionRoom: false,
    title: "Privacy on",
    progress: noPatient ? 0 : s.phase === "identify" ? 1 : s.bodyView === "cow" ? 4 : s.bodyView === "note" ? 3 : 2,
    next: false,
    // Empty leaves the strip to Core, which knows the patient is hidden.
    stripMode: "",
    startLabel: "",
    statusLine: "",
    actions,
    noPatient,
  }
}

function action(s: EncounterState, ...events: EncounterEvent[]): PatientAction {
  return {enabled: canDispatch(s, events[0]), events}
}

function stageOf(s: EncounterState): PatientStage | null {
  if (s.bodyView === "overview") return "overview"
  if (s.bodyView === "care") return "care"
  if (s.bodyView === "cow") return s.note?.status === "pendingReview" ? "cow" : null
  if (s.bodyView !== "note") return null
  const note = s.note
  if (note) {
    if (note.status === "rejected") return null
    if (note.status === "pendingReview") return "saved"
    return note.flags.every((f) => f.resolution !== null) ? "corrected" : "draft"
  }
  if (s.consent === "unasked") return "consent"
  if (s.consent === "declined") return "declined"
  return s.capture === "recording" ? "recording" : "ready"
}

/** The three lines of the COW / EHR screen. Values are Core's; only the row names are the storyboard's. */
function selectCowRows(s: EncounterState, rows: readonly {value: string}[]): CowRow[] {
  const sent = s.downstream.find((x) => x.patientId === s.scannedPatientId && x.version === s.note?.version)
  const signed = sent !== undefined
  const received = sent?.stage === "received"
  return [
    {title: rows[0].value + ".", detail: "", step: "done"},
    {title: "COW review and sign-off", detail: rows[1].value, step: signed ? "done" : "current"},
    {title: "EHR receipt", detail: rows[2].value, step: received ? "done" : signed ? "current" : "todo"},
  ]
}

/**
 * Null when these screens do not cover the state (the older card still does).
 * reopenDismissed is view state, as Core has no event for closing the reopen offer.
 */
export function selectPatientScreen(s: EncounterState, reopenDismissed: boolean = false, captionRoom: boolean = false): PatientView | null {
  if (s.view.minimised) return null
  // Privacy covers every routine view, with or without a verified patient. Emergency and handover keep their own.
  if (s.privacy && s.phase !== "boot" && s.phase !== "emergency" && s.phase !== "handover") return privacyView(s)
  if (!isVerified(s) || s.privacy) return null
  if (s.phase !== "round" && s.phase !== "review") return null
  const pid = s.scannedPatientId
  if (pid === null) return null
  const held = s.interruptedWork[pid]
  const offerReopen = s.bodyView === "overview" && held !== undefined && !reopenDismissed && canDispatch(s, {type: "REOPEN_WORK"})
  const stage = offerReopen ? "reopen" : stageOf(s)
  if (stage === null) return null

  const card = selectCards(s)
  const parts = card.subtitle.split(" · ")
  const record = Fx.summaryFor(pid)
  const line = (id: string) => record.find((r) => r.card === id)
  const dietLine = line("diet")
  const dietParts = dietLine ? dietLine.value.split(" · ") : []
  const nextObs = dietLine ? dietLine.details.map((d) => /observations (\d\d:\d\d)/.exec(d)).find((m) => m !== null) : undefined
  const draft = Sel.selectDraft(s)
  const capture = Sel.selectCapture(s)
  const flag = Fx.flagsFor(pid)[0]
  const right = flag ? flag.options.find((o) => o.id === "right") : undefined
  const flagged = stage === "draft" ? draft.lines.findIndex((l) => /\bleft\b/i.test(l)) : -1
  const patientScreen = stage === "overview" || stage === "care" || stage === "reopen"
  const needsRegrant = s.consent === "declined"
  const view: PatientView = {
    stage,
    height: captionRoom && stage === "recording" ? HEIGHT_RECORDING_CAPTIONS : HEIGHT[stage],
    captionRoom: captionRoom && stage === "recording",
    title: stage === "cow" ? "COW / EHR" : patientScreen ? "Patient overview" : stage === "recording" ? Fx.LABELS.rec : "Routine note",
    initials: Sel.selectIdentity(s).chip.text.split(" ")[0],
    progress: s.bodyView === "cow" ? 4 : s.bodyView === "note" ? 3 : 2,
    // Reopen is decided with its two buttons, and nothing moves on while details are hidden.
    next: stage === "overview" || stage === "care" || stage === "saved" || stage === "cow",
    stripMode: (stage === "cow" ? "COW" : patientScreen ? "Overview" : "Note") + " · " + Fx.DEMO_TIME,
    name: card.title,
    age: (parts[1] ?? "").replace(" years", ""),
    bedLine: parts[0] + " · " + parts[parts.length - 1],
    allergy: "Allergy: " + (line("allergy")?.value ?? Fx.UNKNOWN),
    diagnosis: line("diagnosis")?.value ?? Fx.UNKNOWN,
    vitals: stage === "overview" ? card.vitals : [],
    medication: line("medication")?.value ?? Fx.UNKNOWN,
    observations: nextObs ? nextObs[1] : Fx.UNKNOWN,
    task: line("alert")?.value ?? Fx.UNKNOWN,
    mobility: dietParts.length > 1 ? dietParts[0] : Fx.UNKNOWN,
    diet: dietParts.length > 1 ? dietParts[1] : dietParts[0] ?? Fx.UNKNOWN,
    startLabel: s.note || held ? "Continue note" : "Start note",
    statusLine:
      stage === "declined"
        ? capture.statusMessage
        : stage === "ready" && capture.start.reason !== null
          ? capture.start.reason
          : stage === "ready" && s.capture === "interrupted"
            ? capture.statusMessage
            : "Consent given. Nothing starts automatically.",
    noteLines: draft.lines,
    flaggedLine: flagged,
    evidence: draft.flags[0]?.evidence ?? "",
    correctLabel: "Correct to " + (right ? right.text : "site"),
    version: "v" + (draft.version ?? ""),
    reopenTitle: "Unfinished " + parts[0] + " work",
    cowLine: stage === "cow" ? "Documentation status · " + card.rows[0].label : "",
    cowRows: stage === "cow" ? selectCowRows(s, card.rows) : [],
    actions: {
      startNote: action(s, {type: "OPEN_NOTE"}),
      openCare: action(s, {type: "OPEN_CARE"}),
      toOverview: action(s, {type: "OPEN_OVERVIEW"}),
      reopen: action(s, {type: "REOPEN_WORK"}),
      dismissReopen: action(s, {type: "OPEN_OVERVIEW"}),
      // Core needs consent reset before a decline can be changed.
      consent: needsRegrant ? {enabled: canDispatch(s, {type: "RESET_CONSENT"}), events: [{type: "RESET_CONSENT"}, {type: "GRANT_CONSENT"}]} : action(s, {type: "GRANT_CONSENT"}),
      decline: action(s, {type: "DECLINE_CONSENT"}),
      start: action(s, {type: "START_CAPTURE"}),
      stop: action(s, {type: "STOP_CAPTURE"}),
      correct: {enabled: canDispatch(s, {type: "OPEN_FLAG", flagId: "site"}) || s.view.openFlag === "site", events: [{type: "OPEN_FLAG", flagId: "site"}, {type: "CORRECT_DRAFT", flagId: "site", optionId: "right"}]},
      save: action(s, {type: "SAVE_FOR_REVIEW"}),
      reject: action(s, {type: "REJECT_DRAFT"}),
      downstream: action(s, {type: "OPEN_COW"}),
    },
    noPatient: false,
  }
  return view
}

const WHITE = hex("#FFFFFF")
const SOFT = hex("#C9D1D8")
const ROW = hex("#4B5563")
const ACCENT = hex("#0F9F8E")
const VERIFIED = hex("#34D399")
const VERIFIED_FILL = hex("#34D399", 0.18)
const CAUTION = hex("#FCD34D")
const CAUTION_FILL = hex("#FCD34D", 0.18)
const NEUTRAL_FILL = hex("#FFFFFF", 0.12)
const NEUTRAL_LINE = hex("#FFFFFF", 0.3)
const RISK_FILL = hex("#FFFFFF", 0.08)
const RISK_LINE = hex("#FFFFFF", 0.28)
const CARD_FILL = hex("#FFFFFF", 0.08)
const CARD_LINE = hex("#FFFFFF", 0.16)
const CORE = hex("#5EEAD4")
const SYSTEM = hex("#7DD3FC")
const STEP_TODO = hex("#A5ADB5")
const REC_DOT = hex("#F87171")
const CLEAR = hex("#FFFFFF", 0)


export interface PatientIcons {
  readonly next: Texture
  readonly back: Texture
  readonly mic: Texture
  readonly stop: Texture
  readonly check: Texture
}

export class PatientBody {
  private readonly groups: {[K in PatientStage]?: SceneObject} = {}
  private view: PatientView | null = null
  private name!: Text
  private age!: Text
  private bedLine!: Text
  private pill!: Box
  private pillText!: Text
  private pillCheck!: Image
  private allergyBoxes: Text[] = []
  private diagnosis!: Text
  private obsTitle!: Text
  private vitalLabels: Text[] = []
  private vitalValues: Text[] = []
  private vitalUnits: Text[] = []
  private vitalSub: Text[] = []
  private medication!: Text
  private observations!: Text
  private careMedication!: Text
  private careObservations!: Text
  private careTask!: Text
  private careMobility!: Text
  private careDiet!: Text
  private startNote!: SolidButton
  private openCare!: SolidButton
  private toOverview!: SolidButton
  private consentBtn!: SolidButton
  private declineBtn!: SolidButton
  private declinedLine!: Text
  private captureHeading!: Text
  private captureDot!: Box
  private captureLine!: Text
  private startBtn!: SolidButton
  private stopBtn!: SolidButton
  private captureQuiet!: Text
  private captionGroup!: SceneObject
  private capPrevious!: Text
  private capSpeaker!: Text
  private capText!: Text
  private captions: CaptionFrame | null = null
  private draftLines: Text[] = []
  private evidence!: Text
  private draftSave!: SolidButton
  private correctBtn!: SolidButton
  private correctLabel!: Text
  private draftReject!: SolidButton
  private fixedLines: Text[] = []
  private fixedSave!: SolidButton
  private fixedReject!: SolidButton
  private savedHeading!: Text
  private savedLines: Text[] = []
  private downstream!: SolidButton
  private reopenHeading!: Text
  private reopenBtn!: SolidButton
  private dismissReopenBtn!: SolidButton
  private cowLine!: Text
  private cowSteps: {ring: Box; dot: Box; check: Image; title: Text; detail: Text}[] = []
  private privacyTag!: Text
  private privacyText!: Text

  constructor(
    root: SceneObject,
    private readonly icons: PatientIcons,
    private readonly emit: (e: EncounterEvent) => void,
  ) {
    this.buildHead(root)
    this.buildOverview(root)
    this.buildCare(root)
    this.buildConsent(root)
    this.buildCapture(root)
    this.buildDraft(root)
    this.buildCorrected(root)
    this.buildSaved(root)
    this.buildReopen(root)
    this.buildCow(root)
    this.buildPrivacy(root)
  }

  private fire(id: ActionId): void {
    if (!this.view) return
    for (const e of this.view.actions[id].events) this.emit(e)
  }

  private group(root: SceneObject, stage: PatientStage, also: PatientStage[] = []): SceneObject {
    const g = obj(root, "Body_" + stage)
    this.groups[stage] = g
    for (const a of also) this.groups[a] = g
    return g
  }

  /** Label then icon, centred as a group from the measured text width. */
  private primary(g: SceneObject, name: string, text: string, y: number, textW: number, tex: Texture, id: ActionId, x: number = X, w: number = W, fill: vec4 = ACCENT, weight: number = 600): SolidButton {
    const b = solidButton(g, name, x, y, w, BTN_H, fill, BTN_H / 2, () => this.fire(id))
    const left = (w - (textW + ICON_GAP + ICON)) / 2
    b.labels.push(label(b.face, left, 0, textW + 0.2, BTN_H, text, 1.6, weight, WHITE, {name: name + "Label"}))
    b.icons.push(icon(b.face, tex, left + textW + ICON_GAP, ICON_Y, ICON, WHITE))
    return b
  }

  private secondary(g: SceneObject, name: string, text: string, y: number, id: ActionId, x: number = X, w: number = W, weight: number = 600): SolidButton {
    const b = solidButton(g, name, x, y, w, BTN_H, ROW, BTN_H / 2, () => this.fire(id))
    b.labels.push(label(b.face, 0, 0, w, BTN_H, text, 1.4, weight, WHITE, {align: "center", name: name + "Label"}))
    return b
  }

  private buildHead(root: SceneObject): void {
    this.name = label(root, X, NAME_Y, 20, HEADING_H, "", NAME_FONT, 700, WHITE, {name: "PatientName"})
    this.age = label(root, X, NAME_Y, 3, HEADING_H, "", 1.17, 400, SOFT, {name: "PatientAge"})
    this.bedLine = label(root, X, BED_Y, 22, 1.4, "", 1.17, 400, SOFT, {name: "PatientBedLine"})
    // Raised: on the note screens it sits on the card.
    this.pill = box(root, R - PILL_W_VERIFIED, PILL_Y, PILL_W_VERIFIED, PILL_H, VERIFIED_FILL, PILL_H / 2, {w: 0.08, c: VERIFIED}, true)
    this.pillCheck = icon(root, this.icons.check, R - PILL_W_VERIFIED, PILL_Y, PILL_ICON, VERIFIED)
    this.pillText = label(root, R - PILL_W_VERIFIED, PILL_Y, 5.2, PILL_H, "", 1.4, 700, VERIFIED, {align: "center", name: "PatientPill"})
  }

  private allergy(g: SceneObject): void {
    box(g, X, ALLERGY_Y, W, ALLERGY_H, RISK_FILL, cm(0.9), {w: 0.08, c: RISK_LINE})
    this.allergyBoxes.push(label(g, X + cm(0.6), ALLERGY_Y, W - 2 * cm(0.6), ALLERGY_H, "", 1.4, 600, WHITE, {name: "PatientAllergy"}))
  }

  private field(g: SceneObject, x: number, y: number, w: number, caption: string, name: string): Text {
    label(g, x, y, w, 1.4, caption, 1.17, 400, SOFT)
    return label(g, x, y + 1.42, w, 1.7, "", 1.4, 600, WHITE, {name})
  }

  private buildOverview(root: SceneObject): void {
    const g = this.group(root, "overview")
    this.allergy(g)
    this.diagnosis = label(g, X, DIAGNOSIS_Y, W, DIAGNOSIS_H, "", 1.4, 600, WHITE, {name: "PatientDiagnosis"})
    this.obsTitle = label(g, X, OBS_TITLE_Y, W, 1.3, "", 1.17, 400, SOFT, {name: "PatientObsTitle"})
    for (let i = 0; i < 6; i++) {
      const x = VITAL_COLS[i % 3]
      const y = VITAL_Y + Math.floor(i / 3) * VITAL_PITCH
      this.vitalLabels.push(label(g, x, y, 9, 1.3, "", 1.17, 400, SOFT, {name: "MetricLabel" + i}))
      this.vitalSub.push(label(g, x + 2.25, y + 0.3, 1, 1.2, "2", 0.8, 400, SOFT))
      this.vitalValues.push(label(g, x, y + VITAL_VALUE_DY, 7, 1.7, "", 1.6, 600, WHITE, {name: "MetricValue" + i}))
      this.vitalUnits.push(label(g, x, y + VITAL_VALUE_DY + 0.1, 5, 1.5, "", 1.17, 400, SOFT, {name: "MetricUnit" + i}))
    }
    this.medication = this.field(g, X, DUE_Y, HALF_W, "Next medication", "PatientNextMedication")
    this.observations = this.field(g, HALF_X2, DUE_Y, HALF_W, "Next observations", "PatientNextObservations")
    this.startNote = this.primary(g, "BtnOpenNote", "Start note", OVERVIEW_BTN_Y, 7.32, this.icons.mic, "startNote", X, HALF_W)
    this.openCare = this.secondary(g, "BtnCarePlan", "Open notes", OVERVIEW_BTN_Y, "openCare", HALF_X2, HALF_W)
  }

  private buildCare(root: SceneObject): void {
    const g = this.group(root, "care")
    this.allergy(g)
    label(g, X, CARE_TITLE_Y, W, HEADING_H, "Care plan", 1.6, 600, WHITE, {name: "PatientCareTitle"})
    this.card(g, CARE_Y, CARE_CARD_H)
    const rowsY = CARE_Y + CARD_PAD
    this.careMedication = this.field(g, INNER_X, rowsY, INNER_W, "Medication", "CareMedication")
    this.careObservations = this.field(g, INNER_X, rowsY + CARE_PITCH, INNER_W, "Observations", "CareObservations")
    const taskY = rowsY + 2 * CARE_PITCH
    label(g, INNER_X, taskY, INNER_W, 1.4, "Task", 1.17, 400, SOFT)
    const dot = cm(1.1)
    box(g, INNER_X, taskY + 1.42 + (1.7 - dot) / 2, dot, dot, CLEAR, dot / 2, {w: 0.14, c: WHITE}, true)
    this.careTask = label(g, INNER_X + 1.3, taskY + 1.42, INNER_W - 1.3, 1.7, "", 1.4, 600, WHITE, {name: "CareTask"})
    this.careMobility = this.field(g, INNER_X, rowsY + 3 * CARE_PITCH, HALF_W - CARD_PAD, "Mobility", "CareMobility")
    this.careDiet = this.field(g, HALF_X2, rowsY + 3 * CARE_PITCH, R - CARD_PAD - HALF_X2, "Diet", "CareDiet")
    const b = solidButton(g, "BtnOverview", X, CARE_BTN_Y, W, BTN_H, ROW, BTN_H / 2, () => this.fire("toOverview"))
    const backW = 10.92
    const backX = (W - (ICON + ICON_GAP + backW)) / 2
    b.icons.push(icon(b.face, this.icons.back, backX, ICON_Y, ICON, WHITE))
    b.labels.push(label(b.face, backX + ICON + ICON_GAP, 0, backW + 0.2, BTN_H, "Back to overview", 1.4, 600, WHITE))
    this.toOverview = b
  }

  private buildConsent(root: SceneObject): void {
    const g = this.group(root, "consent", ["declined"])
    label(g, X, BODY_Y, W, HEADING_H, "Ask permission before capture", 1.6, 600, WHITE, {name: "NoteHeading"})
    // Not in the storyboard: a declined screen would otherwise look the same as an unasked one.
    this.declinedLine = label(g, X, cm(14.8), W, 1.4, "", 1.2, 500, SOFT, {name: "NoteDeclined"})
    this.consentBtn = this.primary(g, "BtnConsentGiven", "Consent given", CONSENT_Y, 10.46, this.icons.next, "consent", X, W, ACCENT, 700)
    this.declineBtn = this.secondary(g, "BtnConsentDeclined", "Declined", DECLINE_Y, "decline", X, W, 700)
    label(g, X, CONSENT_QUIET_Y, W, QUIET_H, QUIET, 1.2, 500, SOFT)
  }

  private buildCapture(root: SceneObject): void {
    const g = this.group(root, "ready", ["recording"])
    const dot = cm(1.1)
    this.captureDot = box(g, X, BODY_Y + (HEADING_H - dot) / 2, dot, dot, REC_DOT, dot / 2)
    this.captureHeading = label(g, X, BODY_Y, W, HEADING_H, "", 1.6, 600, WHITE, {name: "NoteHeading"})
    this.captureLine = label(g, X, cm(14.99), W, 1.4, "", 1.17, 400, WHITE, {name: "NoteStatus"})
    this.startBtn = this.primary(g, "BtnStartCapture", "Start note", CAPTURE_Y, 7.32, this.icons.mic, "start")
    this.stopBtn = this.primary(g, "BtnStopCapture", "Stop note", CAPTURE_Y, 7.07, this.icons.stop, "stop")
    this.captureQuiet = label(g, X, CAPTURE_QUIET_Y, W, QUIET_H, QUIET, 1.2, 500, SOFT)
    const cap = obj(g, "LiveCaptions")
    this.captionGroup = cap
    this.card(cap, CAP_CARD_Y, CAP_CARD_H)
    label(cap, INNER_X, CAP_HEAD_Y, INNER_W, 1.4, "Live transcript \u00B7 Simulated", 1.2, 500, SOFT, {name: "CaptionHeader"})
    this.capPrevious = label(cap, INNER_X, CAP_PREV_Y, INNER_W, 1.6, "", 1.4, 400, STEP_TODO, {name: "CaptionPrevious"})
    this.capSpeaker = label(cap, INNER_X, CAP_SPEAKER_Y, INNER_W, 1.4, "", 1.2, 600, CORE, {name: "CaptionSpeaker"})
    this.capText = label(cap, INNER_X, CAP_TEXT_Y, INNER_W, CAP_LINES * LINE_PITCH, "", 1.4, 400, WHITE, {name: "CaptionText", wrap: true})
    this.capText.verticalAlignment = VerticalAlignment.Top
    show(cap, false)
  }

  private card(g: SceneObject, y: number, h: number): void {
    box(g, X, y, W, h, CARD_FILL, CARD_RADIUS, {w: 0.08, c: CARD_LINE})
  }

  /** The note itself: header row (setPill puts the version chip on its right), then the lines. */
  private noteCard(g: SceneObject, into: Text[], y: number, heading: string = "Draft · not submitted"): void {
    this.card(g, y, NOTE_CARD_H)
    const headY = y + CARD_PAD
    label(g, INNER_X, headY, INNER_W - PILL_W_SAVED - 0.5, PILL_H, heading, 1.2, 400, SOFT, {name: "NoteDraftState"})
    const linesY = headY + PILL_H + NOTE_HEAD_GAP
    for (let i = 0; i < 4; i++) into.push(label(g, INNER_X, linesY + i * LINE_PITCH, INNER_W, LINE_H, "", 1.4, 400, WHITE, {name: "NoteLine" + i}))
  }

  private buildDraft(root: SceneObject): void {
    const g = this.group(root, "draft")
    this.noteCard(g, this.draftLines, BODY_Y)
    this.evidence = label(g, X, DRAFT_NOTE_Y, W, 1.4, "", 1.17, 400, SOFT, {name: "NoteEvidence"})
    this.draftSave = this.primary(g, "BtnSaveForReview", Fx.LABELS.saveForReview, DRAFT_SAVE_Y, 15.47, this.icons.next, "save", X, W, ROW)
    this.correctBtn = this.secondary(g, "BtnCorrectSite", "", DRAFT_ROW_Y, "correct", X, HALF_W)
    this.correctLabel = this.correctBtn.labels[0]
    this.draftReject = this.secondary(g, "BtnReject", "Reject", DRAFT_ROW_Y, "reject", HALF_X2, HALF_W)
    label(g, X, DRAFT_QUIET_Y, W, QUIET_H, QUIET, 1.2, 500, SOFT)
  }

  private buildCorrected(root: SceneObject): void {
    const g = this.group(root, "corrected")
    this.noteCard(g, this.fixedLines, BODY_Y)
    const check = cm(1.4)
    icon(g, this.icons.check, X, DRAFT_NOTE_Y + (1.4 - check) / 2, check, VERIFIED)
    label(g, X + check + 0.3, DRAFT_NOTE_Y, W - check - 0.3, 1.4, "Side corrected against transcript", 1.17, 400, VERIFIED, {name: "NoteCorrected"})
    this.fixedSave = this.primary(g, "BtnSaveForReview", Fx.LABELS.saveForReview, DRAFT_SAVE_Y, 15.47, this.icons.next, "save")
    this.fixedReject = this.secondary(g, "BtnReject", "Reject", FIXED_REJECT_Y, "reject")
    label(g, X, FIXED_QUIET_Y, W, QUIET_H, QUIET, 1.2, 500, SOFT)
  }

  private buildSaved(root: SceneObject): void {
    const g = this.group(root, "saved")
    const check = 1.4
    icon(g, this.icons.check, X, BODY_Y + (SAVED_STATUS_H - check) / 2, check, VERIFIED)
    this.savedHeading = label(g, X + check + 0.3, BODY_Y, W - check - 0.3, SAVED_STATUS_H, "", 1.4, 600, WHITE, {name: "NoteHeading"})
    this.noteCard(g, this.savedLines, SAVED_CARD_Y, "Saved for COW review")
    this.downstream = this.primary(g, "BtnDownstream", "View downstream status", SAVED_BTN_Y, 17.89, this.icons.next, "downstream")
    label(g, X, SAVED_QUIET_Y, W, QUIET_H, QUIET, 1.2, 500, SOFT)
  }

  private buildReopen(root: SceneObject): void {
    const g = this.group(root, "reopen")
    this.reopenHeading = label(g, X, BODY_Y, W, HEADING_H, "", NAME_FONT, 700, WHITE, {name: "ReopenHeading"})
    const text = label(g, X, REOPEN_TEXT_Y, W, REOPEN_TEXT_H, "Text from the ended routine encounter is available. It has not been submitted by the interruption.", 1.4, 500, WHITE, {name: "ReopenText", wrap: true})
    text.verticalAlignment = VerticalAlignment.Top
    this.reopenBtn = this.primary(g, "BtnReopenWork", "Reopen unfinished note", REOPEN_BTN_Y, 17.4, this.icons.next, "reopen")
    this.dismissReopenBtn = this.secondary(g, "BtnReopenOverview", "Overview", REOPEN_OVERVIEW_Y, "dismissReopen")
  }

  private buildCow(root: SceneObject): void {
    const g = this.group(root, "cow")
    this.cowLine = label(g, X, BODY_Y, W, 1.4, "", 1.17, 400, SOFT, {name: "CowDocumentationStatus"})
    for (let i = 0; i < 3; i++) {
      const y = COW_LIST_Y + i * COW_PITCH
      const ring = box(g, X, y, COW_ROW_ICON, COW_ROW_ICON, CLEAR, COW_ROW_ICON / 2, {w: cm(0.17), c: STEP_TODO})
      const inset = (COW_ROW_ICON - COW_ROW_DOT) / 2
      const dot = box(g, X + inset, y + inset, COW_ROW_DOT, COW_ROW_DOT, CORE, COW_ROW_DOT / 2, undefined, true)
      const checkInset = (COW_ROW_ICON - COW_ROW_CHECK) / 2
      const check = icon(g, this.icons.check, X + checkInset, y + checkInset, COW_ROW_CHECK, VERIFIED)
      const title = label(g, COW_TEXT_X, y, R - COW_TEXT_X, COW_TITLE_H, "", 1.4, 600, WHITE, {name: "CowRowTitle" + i})
      const detail = label(g, COW_TEXT_X, y + COW_TITLE_H, R - COW_TEXT_X, COW_DETAIL_H, "", 1.17, 400, SOFT, {name: "CowRowDetail" + i})
      this.cowSteps.push({ring, dot, check, title, detail})
    }
  }

  private buildPrivacy(root: SceneObject): void {
    const g = this.group(root, "privacy")
    label(g, X, NAME_Y, W, HEADING_H, "Privacy on", NAME_FONT, 700, WHITE, {name: "PrivacyHeading"})
    // The compact panel's source tag (storyboard W(..., {src: 'Simulated'})), right-aligned on the title row.
    this.privacyTag = label(g, R - 8, NAME_Y, 8, HEADING_H, "Simulated", 1.17, 400, SYSTEM, {align: "right", name: "PrivacySource"})
    this.privacyText = label(g, X, PRIVACY_TEXT_Y, W, PRIVACY_TEXT_H, PRIVACY_FULL, 1.4, 500, WHITE, {name: "PrivacyText", wrap: true})
  }

  private setCowRows(rows: readonly CowRow[]): void {
    this.cowSteps.forEach((step, i) => {
      const row = rows[i]
      if (!row) return
      const done = row.step === "done"
      const current = row.step === "current"
      step.ring.rr.backgroundColor = done ? VERIFIED_FILL : CLEAR
      setBorder(step.ring.rr, {w: cm(0.17), c: done ? VERIFIED : current ? CORE : STEP_TODO})
      show(step.dot.so, current)
      show(step.check.getSceneObject(), done)
      setText(step.title, row.title, current ? CORE : WHITE)
      setText(step.detail, row.detail)
      // A row without a detail line centres its title on the icon.
      const y = COW_LIST_Y + i * COW_PITCH
      placeLabel(step.title, COW_TEXT_X, row.detail === "" ? y + (COW_ROW_ICON - COW_TITLE_H) / 2 : y, R - COW_TEXT_X, COW_TITLE_H)
    })
  }

  private setPill(v: PatientView): void {
    const patient = v.stage === "overview" || v.stage === "care" || v.stage === "reopen"
    const saved = v.stage === "saved"
    const shown = patient || saved || v.stage === "draft" || v.stage === "corrected"
    show(this.pill.so, shown)
    show(this.pillText.getSceneObject(), shown)
    show(this.pillCheck.getSceneObject(), patient || saved)
    if (!shown) return
    const w = patient ? PILL_W_VERIFIED : saved ? PILL_W_SAVED : PILL_W_VERSION
    // In the panel head on the patient screens, in the note card's header row otherwise.
    const x = patient ? R - w : R - CARD_PAD - w
    const y = patient ? PILL_Y : (saved ? SAVED_CARD_Y : BODY_Y) + CARD_PAD
    placeBox(this.pill, x, y, w, PILL_H)
    const ok = patient || saved
    const amber = v.stage === "draft"
    this.pill.rr.backgroundColor = ok ? VERIFIED_FILL : amber ? CAUTION_FILL : NEUTRAL_FILL
    setBorder(this.pill.rr, {w: 0.08, c: ok ? VERIFIED : amber ? CAUTION : NEUTRAL_LINE})
    const ink = ok ? VERIFIED : amber ? CAUTION : WHITE
    if (ok) {
      placeIcon(this.pillCheck, x + VERIFIED_PILL.inset, y + (PILL_H - PILL_ICON) / 2)
      const textX = x + VERIFIED_PILL.inset + PILL_ICON + VERIFIED_PILL.iconGap
      placeLabel(this.pillText, textX, y, x + w - VERIFIED_PILL.end - textX, PILL_H)
    } else placeLabel(this.pillText, x, y, w, PILL_H)
    setText(this.pillText, patient ? "Verified" : v.version, ink)
  }

  private setLines(rows: Text[], lines: readonly string[], flagged: number): void {
    rows.forEach((t, i) => {
      show(t.getSceneObject(), i < lines.length)
      setText(t, lines[i] ?? "", i === flagged ? CAUTION : WHITE)
    })
  }

  private setVitals(v: PatientView): void {
    // The chart time only belongs with vitals Core actually has.
    setText(this.obsTitle, v.vitals.length > 0 ? "Observations · 09:00" : "Observations")
    this.vitalLabels.forEach((t, i) => {
      const m = v.vitals[i]
      const isSpO2 = m !== undefined && m.label.includes("₂")
      setText(t, m ? m.label.replace("₂", "") : i === 0 ? Fx.UNKNOWN : "")
      show(this.vitalSub[i].getSceneObject(), isSpO2)
      setText(this.vitalValues[i], m ? m.display : "")
      setText(this.vitalUnits[i], m ? m.unit : "")
      if (m) {
        const x = VITAL_COLS[i % 3] + m.display.length * 0.87 + 0.35
        placeLabel(this.vitalUnits[i], x, VITAL_Y + Math.floor(i / 3) * VITAL_PITCH + VITAL_VALUE_DY + 0.1, 5, 1.5)
      }
    })
  }

  /** "Continue note" is wider than "Start note": re-centre the group. */
  private setStartLabel(text: string): void {
    const textW = text === "Start note" ? 7.32 : 10.1
    const left = (HALF_W - (textW + ICON_GAP + ICON)) / 2
    placeLabel(this.startNote.labels[0], left, 0, textW + 0.2, BTN_H)
    placeIcon(this.startNote.icons[0], left + textW + ICON_GAP, ICON_Y)
    setText(this.startNote.labels[0], text)
  }

  /** The live captions: null clears them. Called when the words change, not every frame. */
  setCaptions(frame: CaptionFrame | null): void {
    this.captions = frame
    if (this.view && this.view.captionRoom) this.applyCaptions()
  }

  private applyCaptions(): void {
    const f = this.captions
    setText(this.capPrevious, f && f.previous ? f.previous : "")
    setText(this.capSpeaker, f ? f.speaker : "")
    setText(this.capText, f ? f.text : "")
  }

  render(v: PatientView): void {
    this.view = v
    for (const k of Object.keys(HEIGHT) as PatientStage[]) {
      const g = this.groups[k]
      if (g && g !== this.groups[v.stage]) show(g, false)
    }
    const on = this.groups[v.stage]
    if (on) show(on, true)

    const identified = v.stage !== "privacy"
    show(this.name.getSceneObject(), identified)
    show(this.age.getSceneObject(), identified)
    show(this.bedLine.getSceneObject(), identified)
    setText(this.name, v.name)
    placeLabel(this.age, X + v.name.length * CHAR_W_NAME + 0.5, NAME_Y, 3, HEADING_H)
    setText(this.age, v.age)
    setText(this.bedLine, v.bedLine)
    this.setPill(v)
    for (const t of this.allergyBoxes) setText(t, v.allergy)
    const a = v.actions
    if (v.stage === "privacy") {
      show(this.privacyTag.getSceneObject(), v.noPatient)
      // The compact sentence is longer and takes two lines.
      placeLabel(this.privacyText, X, PRIVACY_TEXT_Y, W, v.noPatient ? 2 * PRIVACY_TEXT_H : PRIVACY_TEXT_H)
      setText(this.privacyText, v.noPatient ? PRIVACY_COMPACT : PRIVACY_FULL)
    }

    if (v.stage === "overview") {
      setText(this.diagnosis, v.diagnosis)
      this.setVitals(v)
      setText(this.medication, v.medication)
      setText(this.observations, v.observations)
      this.setStartLabel(v.startLabel)
      setSolidEnabled(this.startNote, a.startNote.enabled)
      setSolidEnabled(this.openCare, a.openCare.enabled)
    } else if (v.stage === "care") {
      setText(this.careMedication, v.medication)
      setText(this.careObservations, v.observations)
      setText(this.careTask, v.task)
      setText(this.careMobility, v.mobility)
      setText(this.careDiet, v.diet)
      setSolidEnabled(this.toOverview, a.toOverview.enabled)
    } else if (v.stage === "consent" || v.stage === "declined") {
      setText(this.declinedLine, v.stage === "declined" ? v.statusLine : "")
      setSolidEnabled(this.consentBtn, a.consent.enabled)
      // Stays lit in the declined state, as in the storyboard; Core refuses a repeat decline.
      setSolidEnabled(this.declineBtn, true)
    } else if (v.stage === "ready" || v.stage === "recording") {
      const rec = v.stage === "recording"
      show(this.captureDot.so, rec)
      placeLabel(this.captureHeading, rec ? X + 1.3 : X, BODY_Y, W - 1.3, HEADING_H)
      setText(this.captureHeading, rec ? "Capture in progress" : "Note", rec ? REC_DOT : WHITE)
      setText(this.captureLine, rec ? "Stop when the observation is complete." : v.statusLine)
      show(this.startBtn.cell, !rec)
      show(this.stopBtn.cell, rec)
      const cap = rec && v.captionRoom
      show(this.captionGroup, cap)
      const stop = this.stopBtn.cell.getTransform()
      stop.setLocalPosition(new vec3(X, -(cap ? CAP_STOP_Y : CAPTURE_Y), stop.getLocalPosition().z))
      placeLabel(this.captureQuiet, X, cap ? CAP_QUIET_Y : CAPTURE_QUIET_Y, W, QUIET_H)
      if (cap) this.applyCaptions()
      setSolidEnabled(this.startBtn, a.start.enabled)
      setSolidEnabled(this.stopBtn, a.stop.enabled)
    } else if (v.stage === "draft") {
      this.setLines(this.draftLines, v.noteLines, v.flaggedLine)
      setText(this.evidence, v.evidence)
      setText(this.correctLabel, v.correctLabel)
      setSolidEnabled(this.draftSave, a.save.enabled)
      setSolidEnabled(this.correctBtn, a.correct.enabled)
      setSolidEnabled(this.draftReject, a.reject.enabled)
    } else if (v.stage === "corrected") {
      this.setLines(this.fixedLines, v.noteLines, -1)
      setSolidEnabled(this.fixedSave, a.save.enabled)
      setSolidEnabled(this.fixedReject, a.reject.enabled)
    } else if (v.stage === "saved") {
      setText(this.savedHeading, Fx.LABELS.savedForReview + ".")
      this.setLines(this.savedLines, v.noteLines, -1)
      setSolidEnabled(this.downstream, a.downstream.enabled)
    } else if (v.stage === "reopen") {
      setText(this.reopenHeading, v.reopenTitle)
      setSolidEnabled(this.reopenBtn, a.reopen.enabled)
      setSolidEnabled(this.dismissReopenBtn, a.dismissReopen.enabled)
    } else if (v.stage === "cow") {
      setText(this.cowLine, v.cowLine)
      this.setCowRows(v.cowRows)
    }
  }
}

function placeIcon(img: Image, x: number, y: number): void {
  const t = img.getSceneObject().getTransform()
  const z = t.getLocalPosition().z
  const s = t.getLocalScale().x
  t.setLocalPosition(new vec3(x + s / 2, -(y + s / 2), z))
}
