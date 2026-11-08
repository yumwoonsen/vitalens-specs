// AC06: changing patient clears encounter-specific content. AC01: a confirmed
// reset returns every value to its initial state. Requirements P8.1, P8.2, G08.
import {test} from "node:test"
import assert from "node:assert/strict"

import {createInitialState, reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import * as Sel from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {savedV2, assertNoOp, run, VERIFY} from "./helpers"

function withHandover(): EncounterState {
  // Build the handover, then go back to Routine round and open a record card.
  return run(
    [
      {type: "OPEN_HANDOVER"},
      {type: "BUILD_HANDOVER"},
      {type: "OPEN_OVERVIEW"},
      {type: "OPEN_CARD", card: "allergy"},
    ],
    savedV2(),
  )
}

const SWITCH = [{type: "TOGGLE_MENU"}, {type: "REQUEST_SWITCH"}, {type: "CONFIRM_PENDING"}] as const

function allViews(s: EncounterState): string {
  return JSON.stringify([
    Sel.selectStatusRail(s),
    Sel.selectWardFlags(s),
    Sel.selectRing(s),
    Sel.selectDock(s),
    Sel.selectIdentity(s),
    Sel.selectRecordCards(s),
    Sel.selectCapture(s),
    Sel.selectDraft(s),
    Sel.selectEmergency(s),
    Sel.selectHandover(s),
  ])
}

test("the fixture encounter has content to clear", () => {
  const s = withHandover()
  assert.equal(s.phase, "round")
  assert.equal(s.view.openCard, "allergy")
  assert.equal(s.handover?.status, "built")
})

test("switch patient asks for confirmation and names what will be cleared", () => {
  const s = run([{type: "TOGGLE_MENU"}, {type: "REQUEST_SWITCH"}], withHandover())
  assert.equal(s.view.pending, "switch")
  const menu = Sel.selectStatusRail(s).menu
  assert.equal(menu.pending, "switch")
  assert.ok(menu.clears.includes("Note drafts and approvals"))
  assert.ok(menu.clears.includes("Handover"))
  // Nothing is cleared until Confirm.
  assert.equal(s.note?.status, "pendingReview")
})

test("cancel leaves the encounter intact", () => {
  const before = withHandover()
  const s = run([{type: "TOGGLE_MENU"}, {type: "REQUEST_SWITCH"}, {type: "CANCEL_PENDING"}], before)
  assert.equal(s.view.pending, "none")
  assert.deepEqual({...s, view: before.view}, before)
})

test("confirmed switch clears every encounter value and returns to the shift brief", () => {
  const before = withHandover()
  const s = run(SWITCH, before)
  const initial = createInitialState()
  assert.equal(s.phase, "clockIn")
  assert.equal(s.session, "demo")
  assert.equal(s.bedId, null)
  assert.equal(s.verification, "idle")
  assert.deepEqual(s.confirmed, initial.confirmed)
  assert.equal(s.scannedPatientId, null)
  assert.equal(s.consent, "unasked")
  assert.equal(s.capture, "idle")
  assert.equal(s.transcript, "none")
  assert.equal(s.note, null)
  assert.deepEqual(s.noteHistory, [])
  assert.equal(s.handover, null)
  assert.equal(s.returnPhase, null)
  assert.equal(s.view.openCard, null)
  assert.equal(s.view.openFlag, null)
  assert.equal(s.view.menuOpen, false)
  assert.equal(s.view.pending, "none")
  assert.equal(Sel.selectIdentity(s).chip.text, "No patient")
  assert.ok(!allViews(s).includes("Tan Ah Lian"), "no Bed 3 patient content remains")
})

test("the next patient needs identification and shows only their own fixture data", () => {
  const s = run([...SWITCH, {type: "SELECT_BED", bedId: "bed4"}], withHandover())
  assert.equal(s.phase, "identify")
  assert.equal(s.verification, "idle")
  const verified = run([...VERIFY, {type: "OPEN_OVERVIEW"}], s)
  const cards = Sel.selectRecordCards(verified)
  assert.equal(cards.visible, true)
  assert.ok(cards.summary.every((line) => line.value === "Unknown" && line.source === null))
  assert.ok(!allViews(verified).includes("Tan Ah Lian"))
  assert.equal(Sel.selectDraft(reduce(verified, {type: "NAV_NEXT"})).exists, false)
})

test("returning to Bed 3 needs identification again and has no earlier draft", () => {
  const s = run(
    [...SWITCH, {type: "SELECT_BED", bedId: "bed4"}, ...SWITCH, {type: "SELECT_BED", bedId: "bed3"}],
    withHandover(),
  )
  assert.equal(s.verification, "idle")
  assert.equal(s.note, null)
  assert.equal(s.handover, null)
})

test("switch is refused without a bed", () => {
  const s = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}, {type: "TOGGLE_MENU"}])
  assertNoOp(s, {type: "REQUEST_SWITCH"})
})

test("AC01: confirmed reset from a full encounter returns the initial state", () => {
  const s = run([{type: "TOGGLE_MENU"}, {type: "REQUEST_RESET"}, {type: "CONFIRM_PENDING"}], withHandover())
  assert.deepEqual(s, createInitialState())
  assert.ok(!allViews(s).includes("Tan Ah Lian"))
})

test("reset needs confirmation", () => {
  const s = run([{type: "TOGGLE_MENU"}, {type: "REQUEST_RESET"}], withHandover())
  assert.equal(s.view.pending, "reset")
  assert.equal(s.note?.status, "pendingReview")
})
