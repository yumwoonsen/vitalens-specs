// AC03: sample capture needs explicit permission, start and stop; an
// interruption never restarts it. Requirements P4.2–P4.8, G10.
import {test} from "node:test"
import assert from "node:assert/strict"

import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectCapture, selectRecordCards, selectStatusRail} from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterEvent, EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {assertNoOp, run, ticks, TO_IDENTIFY, VERIFY} from "./helpers"

function atRound(): EncounterState {
  return run([...TO_IDENTIFY, ...VERIFY, {type: "OPEN_NOTE"}])
}

function recording(): EncounterState {
  return run([{type: "GRANT_CONSENT"}, {type: "START_CAPTURE"}], atRound())
}

test("capture cannot start before consent", () => {
  const s = atRound()
  assert.equal(s.consent, "unasked")
  assertNoOp(s, {type: "START_CAPTURE"})
  assert.equal(selectCapture(s).start.enabled, false)
})

test("consent declined blocks capture and draft until asked again", () => {
  const s = run([{type: "DECLINE_CONSENT"}], atRound())
  assert.equal(s.consent, "declined")
  assertNoOp(s, {type: "START_CAPTURE"})
  assertNoOp(s, {type: "GENERATE_DRAFT"})
  const vm = selectCapture(s)
  assert.equal(vm.statusMessage, "Consent declined. Nothing is captured.")
  assert.equal(vm.transcript, null)
  assert.equal(vm.askAgain.enabled, true)
  const asked = run([{type: "RESET_CONSENT"}, {type: "GRANT_CONSENT"}], s)
  assert.equal(asked.consent, "granted")
  assert.equal(asked.capture, "idle", "granting consent does not start capture")
  assert.equal(selectCapture(asked).start.enabled, true)
})

test("start shows REC; stop gives the labelled sample transcript", () => {
  const rec = recording()
  assert.equal(rec.capture, "recording")
  assert.equal(selectStatusRail(rec).recVisible, true)
  assert.equal(selectCapture(rec).recVisible, true)
  assert.equal(selectCapture(rec).disclosure, "Sample capture: no audio is recorded.")
  assert.equal(selectCapture(rec).transcript, null)
  const stopped = reduce(rec, {type: "STOP_CAPTURE"})
  assert.equal(stopped.capture, "stopped")
  assert.equal(stopped.transcript, "sample")
  assert.equal(selectStatusRail(stopped).recVisible, false)
  const t = selectCapture(stopped).transcript
  assert.ok(t)
  assert.equal(t.label, "Sample transcript")
  assert.ok(t.lines.length > 0)
})

test("privacy interrupts capture, discards the partial sample and hides details", () => {
  const s = reduce(recording(), {type: "PRIVACY_ON"})
  assert.equal(s.privacy, true)
  assert.equal(s.capture, "interrupted")
  assert.equal(s.transcript, "none")
  const rail = selectStatusRail(s)
  assert.equal(rail.recVisible, false)
  assert.equal(rail.privacyOn, true)
  assert.equal(rail.simulatedLabel, "Simulated")
  assert.equal(rail.identity.text, "Patient hidden")
  assert.equal(selectRecordCards(s).visible, false)
  assert.equal(selectCapture(s).visible, false)
  assertNoOp(s, {type: "START_CAPTURE"})
})

test("ending privacy leaves capture interrupted; it never restarts on its own", () => {
  const s = run([{type: "PRIVACY_ON"}, {type: "PRIVACY_OFF"}, ...ticks(200)], recording())
  assert.equal(s.privacy, false)
  assert.equal(s.capture, "interrupted")
  assert.equal(selectCapture(s).statusMessage, "Interrupted. Start again to capture.")
  const restarted = reduce(s, {type: "START_CAPTURE"})
  assert.equal(restarted.capture, "recording", "only Start note resumes capture")
})

const LEAVES: readonly [EncounterEvent, EncounterEvent][] = [
  [{type: "NAV_NEXT"}, {type: "NAV_BACK"}],
  [{type: "NAV_BACK"}, {type: "NAV_NEXT"}],
  [{type: "OPEN_EMERGENCY"}, {type: "CLOSE_EMERGENCY"}],
  [{type: "MINIMISE"}, {type: "RESTORE"}],
  [{type: "AWAY_FROM_BED"}, {type: "NEAR_BED"}],
]

// Minimise only collapses the dashboard into the strip: the recording keeps running, and Restore leaves it so.
const AFTER_LEAVING = (leave: EncounterEvent): string => (leave.type === "OPEN_EMERGENCY" ? "idle" : leave.type === "MINIMISE" ? "recording" : "interrupted")

for (const [leave, back] of LEAVES) {
  test(`${leave.type} ${leave.type === "MINIMISE" ? "keeps recording and" : "interrupts recording and"} ${back.type} does not restart it`, () => {
    const away = reduce(recording(), leave)
    assert.equal(away.capture, AFTER_LEAVING(leave))
    const returned = run([back, ...ticks(10)], away)
    assert.equal(returned.capture, AFTER_LEAVING(leave))
  })
}

test("consent changes never start capture", () => {
  const s = run([{type: "DECLINE_CONSENT"}, {type: "RESET_CONSENT"}, {type: "GRANT_CONSENT"}, ...ticks(5)], atRound())
  assert.equal(s.capture, "idle")
})

test("capture is refused while the patient is not verified", () => {
  const s = run([...TO_IDENTIFY, {type: "NAV_NEXT"}])
  assertNoOp(s, {type: "GRANT_CONSENT"})
  assertNoOp(s, {type: "START_CAPTURE"})
})

test("only the bed with a sample transcript can capture", () => {
  const bed4 = run([
    {type: "START_DEMO"},
    {type: "CLOCK_IN"},
    {type: "SELECT_BED", bedId: "bed4"},
    ...VERIFY,
    {type: "NAV_NEXT"},
    {type: "GRANT_CONSENT"},
  ])
  assert.equal(bed4.verification, "verified")
  assertNoOp(bed4, {type: "START_CAPTURE"})
  assert.match(selectCapture(bed4).start.reason ?? "", /No sample transcript/)
})
