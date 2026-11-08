// VitalLens fixtures (plan Task 6). Every person, record, value and time here is
// fictional and invented for this demonstration. Nothing is read from a real
// record, sensor, wristband or service. No names or identifiers are reused from
// the earlier prototype.
import type {BedId, CardId, FlagId, PatientId} from "./EncounterTypes"

export const UNKNOWN = "Unknown"

/** Fixed demo clock shown in the mini HUD strip. Not the device time. */
export const DEMO_TIME = "09:15"

/** Fixed labels for simulated capabilities (requirements G01, G03, G11). */
export const LABELS = {
  simulated: "Simulated",
  demoSession: "Demo session. Not a real sign-in.",
  scanWristband: "Scan wristband (simulated)",
  scanMismatch: "Scan the mismatched wristband (demo)",
  sampleTranscript: "Sample transcript",
  captureDisclosure: "Sample capture: no audio is recorded.",
  rec: "REC (sample)",
  draft: "Draft (simulated AI)",
  saveForReview: "Save for COW review",
  savedForReview: "Draft saved, pending review on COW",
  sampleVitals: "Sample vitals",
  sampleNotLive: "Sample, not live",
  /** Owner round 2 (D1): the one badge on the moving emergency vitals, always shown with them. */
  playback: "Simulated playback — not live monitoring",
  emergencyReadOnly: "Read-only alert-linked record. Band confirmation is separate. Nothing is recorded.",
  callDoctor: "Call doctor (simulated)",
  callDoctorNotice: "Simulated. No call is placed.",
  handover: "Handover (simulated)",
  buildHandover: "Build handover (simulated)",
  rebuildHandover: "Rebuild handover (simulated)",
} as const

export interface PatientFixture {
  readonly id: PatientId
  readonly fullName: string
  /** Short form, used in the shift overview and the status strip (Slice 1). */
  readonly shortName: string
  readonly initials: string
  /** Display form, for example "14 Mar 1959". */
  readonly dob: string
  /** Fixed age at the demo date, 1 November 2026. Not calculated. */
  readonly age: number
}

export const PATIENTS: {readonly [K in PatientId]: PatientFixture} = {
  "pt-target": {id: "pt-target", fullName: "Mdm Tan Ah Lian", shortName: "A. L. Tan", initials: "A.T.", dob: "6 May 1948", age: 78},
  "pt-mismatch": {id: "pt-mismatch", fullName: "Ahmad Hakeem", shortName: "A. Hakeem", initials: "A.H.", dob: "18 Nov 1976", age: 50},
  "pt-bed1": {id: "pt-bed1", fullName: "K. Wong", shortName: "K. Wong", initials: "K.W.", dob: "3 Feb 1948", age: 78},
  "pt-bed2": {id: "pt-bed2", fullName: "Mr Ahmad Hakim", shortName: "A. Hakim", initials: "A.H.", dob: "22 Jul 1971", age: 55},
  "pt-bed4": {id: "pt-bed4", fullName: "S. Nair", shortName: "S. Nair", initials: "S.N.", dob: "9 Dec 1983", age: 42},
}

/** The wristband the "Scan the mismatched wristband (demo)" control reads. */
export const MISMATCH_PATIENT_ID: PatientId = "pt-mismatch"

/** The routine bed: the highlighted row in the shift overview (Slice 1). */
export const ROUTINE_BED_ID: BedId = "bed2"

/** Shift overview header (storyboard view 1). */
export const SHIFT = {
  eyebrow: "Morning shift · Ward 7A",
  title: "Your assigned patients",
  sub: "A short brief before the first bedside round.",
} as const

export type WardNeedKind = "obs" | "meds" | "fallRisk" | "pendingTask"

export interface WardNeed {
  readonly kind: WardNeedKind
  /** Short flag text, for example "Obs due 10:00". */
  readonly label: string
  /** 24-hour time for timed needs, used for "Next:" in the mini HUD. */
  readonly time: string | null
}

export interface BedAssignment {
  readonly bedId: BedId
  readonly bedLabel: string
  /** Patient assigned to this bed in the shift brief. */
  readonly patientId: PatientId
  /** Patient on the wristband found in this bed by the simulated scan. */
  readonly wristbandPatientId: PatientId
  /** Bed number shown in the shift overview's number disc. */
  readonly bedNumber: number
  /** Shift overview one-line summary. */
  readonly row: string
  /** Shift overview time. */
  readonly due: string
  /** Up to 3 needs, shown on the bed flag and in the shift brief. */
  readonly needs: readonly WardNeed[]
}

export const WARD: readonly BedAssignment[] = [
  {
    bedId: "bed1",
    bedLabel: "Bed 1",
    bedNumber: 1,
    row: "Obs 10:30 · high fall risk",
    due: "10:30",
    patientId: "pt-bed1",
    wristbandPatientId: "pt-bed1",
    needs: [
      {kind: "obs", label: "Obs due 10:30", time: "10:30"},
      {kind: "fallRisk", label: "Fall risk", time: null},
    ],
  },
  {
    bedId: "bed2",
    bedLabel: "Bed 2",
    bedNumber: 2,
    row: "Meds due · wound review",
    due: "09:30",
    patientId: "pt-bed2",
    wristbandPatientId: "pt-bed2",
    needs: [
      {kind: "meds", label: "Meds due 09:30", time: "09:30"},
      {kind: "pendingTask", label: "Pending task", time: null},
    ],
  },
  {
    bedId: "bed3",
    bedLabel: "Bed 3",
    bedNumber: 3,
    row: "Obs due · high fall risk",
    due: "10:00",
    patientId: "pt-target",
    wristbandPatientId: "pt-target",
    needs: [
      {kind: "obs", label: "Obs due 10:00", time: "10:00"},
      {kind: "fallRisk", label: "Fall risk", time: null},
    ],
  },
  {
    bedId: "bed4",
    bedLabel: "Bed 4",
    bedNumber: 4,
    row: "Medication round",
    due: "11:00",
    patientId: "pt-bed4",
    wristbandPatientId: "pt-bed4",
    needs: [{kind: "meds", label: "Meds due 11:00", time: "11:00"}],
  },
]

export function assignmentFor(bedId: BedId): BedAssignment {
  for (const bed of WARD) if (bed.bedId === bedId) return bed
  throw new Error("Unknown bed " + bedId)
}

/** One line of the always-shown seven-line summary, with its detail card. */
export interface RecordLine {
  readonly card: CardId
  readonly label: string
  readonly value: string
  /** null when the value is Unknown. */
  readonly source: string | null
  readonly time: string | null
  /** Detail card lines (7 or fewer), shown on demand. */
  readonly details: readonly string[]
}

export const SUMMARY_ORDER: readonly {readonly card: CardId; readonly label: string}[] = [
  {card: "diagnosis", label: "Diagnosis"},
  {card: "medication", label: "Key medication"},
  {card: "allergy", label: "Allergy"},
  {card: "alert", label: "Alert"},
  {card: "diet", label: "Diet and obs"},
  {card: "vitals", label: "Last vitals"},
]

/** Sample record for the target patient only (6 lines, owner round 2b). Other patients read Unknown. */
const TARGET_RECORD: readonly RecordLine[] = [
  {
    card: "diagnosis",
    label: "Diagnosis",
    value: "#NOF right, post-fall, day 2",
    source: "Admission record (sample)",
    time: "30 Oct 21:40",
    details: ["Fractured neck of femur (#NOF), right, after a fall", "Atrial fibrillation (history)"],
  },
  {
    card: "medication",
    label: "Key medication",
    value: "Warfarin 3 mg ON",
    source: "Medication chart (sample)",
    time: "1 Nov 08:00",
    details: ["Warfarin 3 mg every night (blood thinner)", "Paracetamol 1 g 4 times daily"],
  },
  {
    card: "allergy",
    label: "Allergy",
    value: "Penicillin: anaphylaxis",
    source: "Allergy record (sample)",
    time: "30 Oct 21:45",
    details: ["Penicillin: anaphylaxis"],
  },
  {
    card: "alert",
    label: "Alert",
    value: "High fall risk, assist x1",
    source: "Risk assessment (sample)",
    time: "31 Oct 08:10",
    details: ["High fall risk: assist x1 to stand and walk"],
  },
  {
    card: "diet",
    label: "Diet and obs",
    value: "Soft diabetic diet · obs due 10:00",
    source: "Diet order and obs schedule (sample)",
    time: "1 Nov 06:00",
    details: ["Soft diabetic diet", "Obs due 10:00, every 4 hours"],
  },
  {
    card: "vitals",
    label: "Last vitals",
    value: "06:00 HR 88 · BP 132/78 · SpO₂ 95% · NEWS 2",
    source: "Sample vitals",
    time: "1 Nov 06:00",
    details: ["HR 88 bpm", "BP 132/78 mmHg", "SpO₂ 95%", "NEWS 2 (fixed sample, not calculated)"],
  },
]

/** The six summary lines for a patient. Facts missing from the fixtures read Unknown. */
export function summaryFor(patientId: PatientId): readonly RecordLine[] {
  if (patientId === "pt-target") return TARGET_RECORD
  if (patientId === "pt-bed2") return ROUTINE_RECORD
  return SUMMARY_ORDER.map(({card, label}) => ({card, label, value: UNKNOWN, source: null, time: null, details: [UNKNOWN]}))
}

/** Fixed sample transcript (no audio is recorded). Only the target patient has one. */
export const TRANSCRIPT: readonly string[] = [
  "Nurse: I'm checking the dressing on your right hip now.",
  "Patient: It aches when I move.",
  "Nurse: Dressing dry and intact. Pain 4 out of 10.",
  "Nurse: I'll help you to the chair, one assist.",
]

export function hasSampleTranscript(patientId: PatientId): boolean {
  return patientId === "pt-target" || patientId === "pt-bed2"
}

export interface PickOption {
  readonly id: string
  readonly label: string
  /** Text placed into the note when this option is chosen. */
  readonly text: string
}

export interface DraftFlagFixture {
  readonly id: FlagId
  readonly label: string
  /** Option id the simulated AI drafted (the seeded error). */
  readonly drafted: string
  readonly evidence: string
  /** 4 options or fewer, always including Unknown. */
  readonly options: readonly PickOption[]
}

/** The draft's one seeded error: it says left where the transcript says right. */
export const DRAFT_FLAGS: readonly DraftFlagFixture[] = [
  {
    id: "site",
    label: "Wound site",
    drafted: "left",
    evidence: "Transcript: \"the dressing on your right hip\"",
    options: [
      {id: "right", label: "Right hip (matches transcript)", text: "right hip"},
      {id: "left", label: "Left hip (as drafted)", text: "left hip"},
      {id: "unknown", label: UNKNOWN, text: "site Unknown"},
    ],
  },
]

export function flagFixture(flagId: FlagId, patientId: PatientId | null = "pt-target"): DraftFlagFixture {
  for (const f of flagsFor(patientId)) if (f.id === flagId) return f
  throw new Error("Unknown flag " + flagId)
}

/** Draft note lines. "{site}" is replaced by the chosen (or drafted) wound site. */
export const DRAFT_TEMPLATE: readonly string[] = [
  "Wound check, {site}.",
  "Dressing dry and intact.",
  "Pain 4 out of 10.",
  "Assisted x1 to the chair (high fall risk).",
]

export interface EmergencyCard {
  readonly id: "code" | "allergy" | "diagnosis" | "medications" | "alerts"
  readonly label: string
  readonly value: string
  readonly source: string | null
  readonly time: string | null
}

export interface SampleVital {
  readonly id: "hr" | "spo2" | "bp" | "temp"
  readonly label: string
  /** null when the value is Unknown. */
  readonly value: number | null
  /** Display text for values that are not a single number, such as blood pressure. */
  readonly text: string | null
  readonly unit: string
  /** Fixture's normal range. A value outside it is shown in caution amber. */
  readonly normal: {readonly min: number; readonly max: number} | null
  readonly source: string | null
  readonly time: string | null
}

export const EMERGENCY = {
  banner: "Code blue, Bed 3 (simulated drill)",
  cards: [
    {id: "medications", label: "Medications", value: "Warfarin 3 mg ON (blood thinner). Paracetamol 1 g 4 times daily", source: "Medication chart (sample)", time: "1 Nov 08:00"},
    {id: "code", label: "Code status", value: "Full code", source: "Resuscitation status (sample)", time: "30 Oct 22:00"},
    {id: "allergy", label: "Allergy", value: "Penicillin: anaphylaxis", source: "Allergy record (sample)", time: "30 Oct 21:45"},
    {id: "diagnosis", label: "Diagnosis", value: "#NOF right, post-fall. Atrial fibrillation (history)", source: "Admission record (sample)", time: "30 Oct 21:40"},
    {id: "alerts", label: "Alerts", value: "High fall risk, assist x1", source: "Risk assessment (sample)", time: "31 Oct 08:10"},
  ] as readonly EmergencyCard[],
  vitals: [
    {id: "hr", label: "HR", value: 84, text: null, unit: "bpm", normal: {min: 51, max: 90}, source: "Sample vitals", time: "09:00"},
    {id: "spo2", label: "SpO₂", value: 93, text: null, unit: "%", normal: {min: 94, max: 100}, source: "Sample vitals", time: "09:00"},
    {id: "bp", label: "BP", value: null, text: "128/76", unit: "mmHg", normal: null, source: "Sample vitals", time: "09:00"},
    {id: "temp", label: "Temp", value: null, text: null, unit: "°C", normal: null, source: null, time: null},
  ] as readonly SampleVital[],
}

/**
 * Owner round 2 (D1): scripted, deterministic playback for the emergency drill. Each frame
 * holds from its second until the next; the last frame holds. Identical every run, read
 * from no sensor. The drill clock lives in the view and is never saved.
 */
export const EMERGENCY_PLAYBACK: readonly {readonly at: number; readonly hr: number; readonly spo2: number}[] = [
  {at: 0, hr: 84, spo2: 93},
  {at: 10, hr: 88, spo2: 92},
  {at: 20, hr: 92, spo2: 92},
  {at: 30, hr: 96, spo2: 91},
  {at: 40, hr: 100, spo2: 90},
  {at: 50, hr: 104, spo2: 90},
  {at: 60, hr: 108, spo2: 89},
]

export interface HandoverTask {
  readonly id: string
  readonly text: string
  readonly owner: string
}

/** Pending tasks for the target patient. No control marks them done. */
export const HANDOVER_TASKS: readonly HandoverTask[] = [
  {id: "obs", text: "Obs due 10:00", owner: "Oncoming nurse, Bed 3"},
  {id: "dressing", text: "Recheck the hip dressing at 14:00", owner: "Day shift nurse"},
]

/** Accepted cards storyboard: distinct routine data, never borrowed from emergency. */
const ROUTINE_RECORD: readonly RecordLine[] = [
 {card:"diagnosis",label:"Diagnosis",value:"Right knee replacement · day 2",source:"Sample chart",time:"09:00",details:["Right knee replacement · day 2"]},
 {card:"medication",label:"Next medication",value:"09:30 · paracetamol",source:"Sample chart",time:"09:00",details:["Paracetamol at 09:30 · pending. Not an administration control."]},
 {card:"allergy",label:"Allergy",value:"None",source:"Sample chart",time:"09:00",details:["No known allergy in the fictional chart"]},
 {card:"alert",label:"Pending task",value:"Wound review · morning nurse",source:"Shift tasks",time:"09:00",details:["Wound review · pending · morning nurse"]},
 {card:"diet",label:"Mobility / diet",value:"Assist ×1 · Regular diet",source:"Sample chart",time:"09:00",details:["Assist ×1", "Regular diet", "Next observations 10:30 · pending"]},
 {card:"vitals",label:"Observations",value:"HR 78 · SpO₂ 97% · BP 124/76 · NEWS 0 (sample)",source:"Sample chart",time:"09:00",details:["HR 78 bpm", "SpO₂ 97%", "BP 124/76 mmHg", "Temp 36.8 °C", "RR 16 /min", "NEWS 0 (sample, not calculated)"]},
]
export function transcriptFor(pid: PatientId | null): readonly string[] {
 if (pid === "pt-bed2") return ["Nurse: Checking the dressing on your right knee.","Patient: It aches a little when I move. Mostly the right knee, just around the dressing. When I keep still it's alright. If I had to say, maybe three out of ten.","Nurse: Dressing dry and intact. Pain 3 out of 10. One assist to chair."]
 return pid === "pt-target" ? TRANSCRIPT : []
}
export function flagsFor(pid: PatientId | null): readonly DraftFlagFixture[] {
 if (pid === "pt-bed2") return DRAFT_FLAGS.map(f=>({...f,evidence:'Transcript: "the dressing on your right knee"',options:f.options.map(o=>({...o,label:o.label.replace(/hip/g,"knee"),text:o.text.replace(/hip/g,"knee")}))}))
 return pid === "pt-target" ? DRAFT_FLAGS : []
}
export function draftTemplateFor(pid: PatientId | null): readonly string[] {
 return pid === "pt-bed2" ? ["Wound check, {site}.","Dressing dry and intact.","Pain 3 out of 10 on movement.","Assisted to chair with one person."] : pid === "pt-target" ? DRAFT_TEMPLATE : []
}
export function handoverTasksFor(pid: PatientId | null): readonly HandoverTask[] {
 return pid === "pt-bed2" ? [{id:"obs",text:"Obs due 10:30",owner:"Oncoming nurse, Bed 2"},{id:"dressing",text:"Wound review · pending",owner:"Morning nurse"}] : pid === "pt-target" ? HANDOVER_TASKS : []
}
export const ROUTINE_VITALS = [
 {label:"HR",display:"78",unit:"bpm"},{label:"SpO₂",display:"97",unit:"%"},{label:"BP",display:"124/76",unit:"mmHg"},
 {label:"Temp",display:"36.8",unit:"°C"},{label:"RR",display:"16",unit:"/min"},{label:"NEWS",display:"0",unit:"sample"},
] as const
