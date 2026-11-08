// G01, G03, G11 (AC11 at the core level): the simulation label is always present and
// each simulated capability carries its label. P2.1–P2.4: shift brief, bed flags
// and counts come from the assignment fixture and flags never identify people.
import {test} from "node:test"
import assert from "node:assert/strict"

import * as Fx from "../../Assets/Scripts/Core/EncounterFixtures"
import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import * as Sel from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterEvent} from "../../Assets/Scripts/Core/EncounterTypes"
import {ALL_EVENTS, CORRECT_RIGHT, run, trace, TO_IDENTIFY, TO_REVIEW, TO_TRANSCRIPT, VERIFY} from "./helpers"

const WALKTHROUGH: readonly EncounterEvent[] = [
  ...TO_IDENTIFY,
  {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"},
  {type: "RESCAN"},
  ...VERIFY,
  ...TO_TRANSCRIPT.slice(0, 3),
  {type: "PRIVACY_ON"},
  {type: "PRIVACY_OFF"},
  {type: "START_CAPTURE"},
  {type: "STOP_CAPTURE"},
  ...TO_REVIEW,
  ...CORRECT_RIGHT,
  {type: "SAVE_FOR_REVIEW"},
  {type: "OPEN_HANDOVER"},
  {type: "MINIMISE"},
  {type: "RESTORE"},
  {type: "BUILD_HANDOVER"},
  {type: "APPROVE_HANDOVER"},
  {type: "OPEN_EMERGENCY"},
  {type: "CLOSE_EMERGENCY"},
  {type: "NAV_BACK"},
  {type: "NAV_BACK"},
  {type: "AMEND_NOTE"},
  {type: "TOGGLE_MENU"},
  {type: "REQUEST_SWITCH"},
  {type: "CONFIRM_PENDING"},
  {type: "TOGGLE_MENU"},
  {type: "REQUEST_RESET"},
  {type: "CONFIRM_PENDING"},
]

test("the walkthrough reaches every phase", () => {
  const phases = new Set(trace(WALKTHROUGH).map((s) => s.phase))
  assert.deepEqual([...phases].sort(), ["boot", "clockIn", "emergency", "handover", "identify", "review", "round"])
})

test("the store is marked simulated and the Boot label stays available in every state", () => {
  const states = [...trace(WALKTHROUGH), ...trace([...TO_IDENTIFY, ...ALL_EVENTS, ...ALL_EVENTS])]
  for (const s of states) {
    assert.equal(s.simulated, true)
    assert.equal(Sel.selectStatusRail(s).simulatedLabel, "Simulated")
  }
})

test("each simulated capability carries its label where it appears", () => {
  const states = trace(WALKTHROUGH)
  const seen = new Set<string>()
  for (const s of states) {
    seen.add(Sel.selectIdentity(s).scanLabel)
    seen.add(Sel.selectIdentity(s).scanMismatchLabel)
    const t = Sel.selectCapture(s).transcript
    if (t) seen.add(t.label)
    if (Sel.selectDraft(s).visible) seen.add(Sel.selectDraft(s).label)
    if (Sel.selectEmergency(s).visible) seen.add(Sel.selectEmergency(s).vitalsLabel)
    if (Sel.selectHandover(s).visible) seen.add(Sel.selectHandover(s).label)
  }
  for (const label of [
    "Scan wristband (simulated)",
    "Scan the mismatched wristband (demo)",
    "Sample transcript",
    "Draft (simulated AI)",
    "Sample vitals",
    "Handover (simulated)",
  ]) {
    assert.ok(seen.has(label), `label "${label}" appears`)
  }
})

test("no text claims a live service, real record system or validation", () => {
  const text = JSON.stringify([Fx, ...trace(WALKTHROUGH).map((s) => [
    Sel.selectStatusRail(s),
    Sel.selectIdentity(s),
    Sel.selectRecordCards(s),
    Sel.selectCapture(s),
    Sel.selectDraft(s),
    Sel.selectEmergency(s),
    Sel.selectHandover(s),
  ])])
  assert.doesNotMatch(text, /NEHR/)
  assert.doesNotMatch(text, /complian|validated|certified|regulator/i)
  assert.doesNotMatch(text, /(?<!not )\blive\b/i)
  assert.doesNotMatch(text, /was sent|has been sent|sent to/i)
})

test("Clock in shows a demo session, 4 assigned patients and flags with needs only", () => {
  const s = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}])
  const ward = Sel.selectWardFlags(s)
  assert.equal(ward.sessionLabel, "Demo session. Not a real sign-in.")
  assert.equal(ward.flagsVisible, true)
  assert.equal(ward.briefVisible, true)
  assert.equal(ward.brief.length, 4)
  assert.equal(ward.flags.length, 4)
  const flagText = JSON.stringify(ward.flags)
  for (const p of Object.values(Fx.PATIENTS)) {
    assert.ok(!flagText.includes(p.fullName), "flags carry no names")
    assert.ok(!flagText.includes(p.initials), "flags carry no initials")
  }
  for (const flag of ward.flags) assert.ok(flag.needs.length >= 1 && flag.needs.length <= 3)
  assert.deepEqual(ward.counts, {assigned: 4, obsDue: 2, medsDue: 2, fallRisk: 2})
  assert.equal(ward.nextNeed, "Next: Bed 2, meds 09:30")
  // The brief lists beds by number and initials (P2.1).
  assert.deepEqual(ward.brief.map((b) => b.bedLabel), ["Bed 1", "Bed 2", "Bed 3", "Bed 4"])
  assert.equal(ward.brief[2].initials, "A.T.")
})

test("bed flags hide during an encounter and under privacy, and show while walking", () => {
  const atBed = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}, {type: "SELECT_BED", bedId: "bed3"}])
  assert.equal(Sel.selectWardFlags(atBed).flagsVisible, false)
  const walking = reduce(atBed, {type: "AWAY_FROM_BED"})
  assert.equal(Sel.selectWardFlags(walking).flagsVisible, true)
  assert.equal(Sel.selectStatusRail(walking).minimised, true)
  assert.equal(Sel.selectStatusRail(walking).nextWardNeed, "Next: Bed 2, meds 09:30")
  const hidden = reduce(walking, {type: "PRIVACY_ON"})
  assert.equal(Sel.selectWardFlags(hidden).flagsVisible, false)
})

test("the mismatch patient shares initials but not identifiers with the target", () => {
  const target = Fx.PATIENTS["pt-bed2"]
  const other = Fx.PATIENTS["pt-mismatch"]
  assert.equal(target.initials, other.initials)
  assert.notEqual(target.fullName, other.fullName)
  assert.notEqual(target.dob, other.dob)
})

test("the six-line summary uses Unknown, never an inferred value, when a fact is missing", () => {
  for (const p of Object.keys(Fx.PATIENTS) as (keyof typeof Fx.PATIENTS)[]) {
    const lines = Fx.summaryFor(p)
    assert.equal(lines.length, 6)
    for (const l of lines) {
      if (l.value === "Unknown") assert.equal(l.source, null)
      else assert.ok(l.source && l.time)
    }
  }
})

test("the dock never offers Next on Boot or at the end, and Emergency becomes Close emergency", () => {
  const boot = Sel.selectDock(run([]))
  assert.equal(boot.next.enabled, false)
  assert.equal(boot.back.enabled, false)
  const em = Sel.selectDock(run([...TO_IDENTIFY, {type: "OPEN_EMERGENCY"}]))
  assert.equal(em.emergency.label, "Close emergency")
  assert.equal(em.minimise.enabled, false)
})

test("the ring shows real progress only", () => {
  const scanned = run([...TO_IDENTIFY, VERIFY[0], VERIFY[1]])
  assert.deepEqual(Sel.selectRing(scanned).progress, {done: 1, total: 2})
  const v1 = run([...TO_IDENTIFY, ...VERIFY, ...TO_TRANSCRIPT, ...TO_REVIEW])
  assert.deepEqual(Sel.selectRing(v1).progress, {done: 1, total: 3})
  const v2 = run(CORRECT_RIGHT, v1)
  assert.deepEqual(Sel.selectRing(v2).progress, {done: 2, total: 3})
  assert.equal(Sel.selectRing(run([])).progress, null)
})

test("Slice 1: shift overview rows, counters and the highlighted Bed 2 follow the storyboard", () => {
  const ward = Sel.selectWardFlags(run([{type: "START_DEMO"}, {type: "CLOCK_IN"}]))
  assert.equal(ward.header.eyebrow, "Morning shift · Ward 7A")
  assert.equal(ward.header.title, "Your assigned patients")
  assert.deepEqual(
    ward.brief.map((b) => [b.bedNumber, b.name, b.row, b.due, b.highlighted]),
    [
      [1, "K. Wong", "Obs 10:30 · high fall risk", "10:30", false],
      [2, "A. Hakim", "Meds due · wound review", "09:30", true],
      [3, "A. L. Tan", "Obs due · high fall risk", "10:00", false],
      [4, "S. Nair", "Medication round", "11:00", false],
    ],
  )
  assert.deepEqual(ward.counters, [
    {label: "Assigned", value: 4},
    {label: "Obs due", value: 2},
    {label: "Meds due", value: 2},
  ])
})

test("Slice 1: the strip shows patient, ID state, mode and time, then the next need", () => {
  const shift = Sel.selectStatusRail(run([{type: "START_DEMO"}, {type: "CLOCK_IN"}])).strip
  assert.deepEqual(
    [shift.patient, shift.idState, shift.mode, shift.need],
    ["No patient", null, "Shift · 09:15", "Bed 2, meds 09:30"],
  )
  const atBed2 = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}, {type: "SELECT_BED", bedId: "bed2"}])
  const chosen = Sel.selectStatusRail(atBed2).strip
  assert.deepEqual([chosen.patient, chosen.idText, chosen.mode], ["A. Hakim · Bed 2", "Not verified", "Verify · 09:15"])
  const mismatch = Sel.selectStatusRail(reduce(atBed2, {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"})).strip
  assert.equal(mismatch.idText, "ID mismatch, stop")
  const verified = Sel.selectStatusRail(run(VERIFY, atBed2)).strip
  assert.equal(verified.idText, "Verified")
  // The verified bed's own need is left out of Next.
  assert.equal(verified.need, "Bed 3, obs 10:00")
  const hidden = Sel.selectStatusRail(reduce(atBed2, {type: "PRIVACY_ON"})).strip
  assert.deepEqual([hidden.patient, hidden.idState, hidden.need], ["Patient hidden", null, "Ward details hidden"])
})
