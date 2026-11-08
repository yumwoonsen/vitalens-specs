// AC02: mismatched or unconfirmed patient context blocks encounter actions;
// valid confirmation recovers. Requirements P2.5, P3.1–P3.6, G04.
import {test} from "node:test"
import assert from "node:assert/strict"

import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectCapture, selectEmergency, selectIdentity, selectRecordCards} from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterEvent, EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {assertNoOp, run, TO_IDENTIFY, VERIFY} from "./helpers"

const ENCOUNTER_ACTIONS: readonly EncounterEvent[] = [
  {type: "OPEN_CARD", card: "allergy"},
  {type: "GRANT_CONSENT"},
  {type: "DECLINE_CONSENT"},
  {type: "START_CAPTURE"},
  {type: "GENERATE_DRAFT"},
  {type: "OPEN_FLAG", flagId: "site"},
  {type: "CORRECT_DRAFT", flagId: "site", optionId: "right"},
  {type: "SAVE_FOR_REVIEW"},
  {type: "REJECT_DRAFT"},
  {type: "AMEND_NOTE"},
  {type: "BUILD_HANDOVER"},
  {type: "APPROVE_HANDOVER"},
]

function assertBlocked(s: EncounterState): void {
  for (const e of ENCOUNTER_ACTIONS) assertNoOp(s, e)
}

test("selecting a bed does not verify the patient", () => {
  const s = run(TO_IDENTIFY)
  assert.equal(s.phase, "identify")
  assert.equal(s.bedId, "bed3")
  assert.equal(s.verification, "idle")
  assert.equal(selectIdentity(s).chip.text, "Not confirmed")
  assert.equal(selectIdentity(s).chip.tone, "caution")
  assertBlocked(s)
})

test("unconfirmed patient: Next to Routine round still blocks every encounter action", () => {
  const s = run([...TO_IDENTIFY, {type: "NAV_NEXT"}])
  assert.equal(s.phase, "round")
  assertBlocked(s)
  const cards = selectRecordCards(s)
  assert.equal(cards.visible, false)
  assert.equal(cards.blockedReason, "Confirm the patient first")
  assert.equal(selectCapture(s).visible, false)
  assert.equal(selectIdentity(s).gateVisible, true)
})

test("one confirmed identifier is not enough", () => {
  const s = run([...TO_IDENTIFY, VERIFY[0], VERIFY[1]])
  assert.equal(s.verification, "scanned")
  assert.deepEqual(s.confirmed, {name: true, dob: false})
  assertBlocked(s)
  const id = selectIdentity(s)
  assert.equal(id.rows.length, 2)
  assert.equal(id.rows[0].confirmed, true)
  assert.equal(id.rows[1].confirm.enabled, true)
})

test("scan plus both identifiers verifies and unlocks encounter actions", () => {
  const s = run([...TO_IDENTIFY, ...VERIFY])
  assert.equal(s.verification, "verified")
  const id = selectIdentity(s)
  assert.equal(id.chip.tone, "verified")
  assert.equal(id.chip.text, "A.T. · Verified")
  assert.equal(id.verifiedSummary, "Mdm Tan Ah Lian, 78, Bed 3, ✓ 2 identifiers")
  assert.notEqual(reduce(s, {type: "GRANT_CONSENT"}), s)
  // Summary is visible straight after verification, without another step.
  assert.equal(selectRecordCards(s).visible, true)
  assert.equal(selectRecordCards(s).summary.length, 6)
})

test("mismatched wristband blocks confirmation and encounter actions", () => {
  const s = run([...TO_IDENTIFY, {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"}])
  assert.equal(s.verification, "mismatch")
  assert.equal(s.scannedPatientId, "pt-mismatch")
  assertNoOp(s, {type: "CONFIRM_IDENTIFIER", identifier: "name"})
  assertNoOp(s, {type: "CONFIRM_IDENTIFIER", identifier: "dob"})
  assertBlocked(s)
  const id = selectIdentity(s)
  assert.equal(id.mismatch, true)
  assert.match(id.mismatchMessage ?? "", /ID mismatch, stop/)
  assert.equal(id.chip.text, "ID mismatch, stop")
  assert.equal(id.rows.every((r) => !r.confirm.enabled), true)
  // Assignment and wristband identifiers differ side by side.
  assert.notEqual(id.rows[0].assignment, id.rows[0].wristband)
  assert.notEqual(id.rows[1].assignment, id.rows[1].wristband)
  assert.equal(id.rescan.enabled, true)
  assert.equal(id.backToBrief.enabled, true)
})

test("mismatch recovers through rescan and valid confirmation", () => {
  const blocked = run([...TO_IDENTIFY, {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"}, {type: "NAV_NEXT"}])
  assertBlocked(blocked)
  const back = run([{type: "NAV_BACK"}, {type: "RESCAN"}], blocked)
  assert.equal(back.verification, "idle")
  assert.equal(back.scannedPatientId, null)
  const recovered = run(VERIFY, back)
  assert.equal(recovered.verification, "verified")
  assert.notEqual(reduce(recovered, {type: "GRANT_CONSENT"}), recovered)
})

test("Doesn't match after a matching scan gives the same block", () => {
  const s = run([...TO_IDENTIFY, VERIFY[0], VERIFY[1], {type: "MARK_MISMATCH"}])
  assert.equal(s.verification, "mismatch")
  assert.deepEqual(s.confirmed, {name: false, dob: false})
  assertBlocked(s)
  assert.equal(selectIdentity(s).mismatch, true)
})

test("Doesn't match is refused once the patient is verified", () => {
  const s = run([...TO_IDENTIFY, ...VERIFY])
  assertNoOp(s, {type: "MARK_MISMATCH"})
})

test("Back to shift brief clears the bed and identification", () => {
  const s = run([...TO_IDENTIFY, {type: "SCAN_WRISTBAND", wristband: "mismatchDemo"}, {type: "BACK_TO_BRIEF"}])
  assert.equal(s.phase, "clockIn")
  assert.equal(s.bedId, null)
  assert.equal(s.verification, "idle")
  assert.equal(s.scannedPatientId, null)
})

test("another bed cannot be chosen while an encounter is open", () => {
  const s = run([...TO_IDENTIFY, ...VERIFY, {type: "NAV_BACK"}, {type: "NAV_BACK"}])
  assert.equal(s.phase, "clockIn")
  assertNoOp(s, {type: "SELECT_BED", bedId: "bed4"})
  // Re-entering the same bed keeps the encounter.
  const again = reduce(s, {type: "SELECT_BED", bedId: "bed3"})
  assert.equal(again.phase, "identify")
  assert.equal(again.verification, "verified")
})

test("emergency before verification immediately shows the alert-linked record", () => {
  const s = run([...TO_IDENTIFY, {type: "OPEN_EMERGENCY"}])
  assert.equal(s.phase, "emergency")
  const em = selectEmergency(s)
  assert.equal(em.active, true)
  assert.equal(em.showGate, false)
  assert.equal(em.visible, true)
  assert.equal(selectIdentity(s).gateVisible, false, "the two-identifier gate is not shown over emergency")
  assert.equal(selectIdentity(s).blockedReason, "Confirm the patient first", "encounter actions stay blocked")
})

test("scanning needs a bed in Identify", () => {
  const s = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}])
  assertNoOp(s, {type: "SCAN_WRISTBAND", wristband: "assigned"})
})
