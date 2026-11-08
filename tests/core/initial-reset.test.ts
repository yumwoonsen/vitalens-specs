// Task 5 spike: initial state and RESET (AC01). Written before the reducer.
import {test} from "node:test"
import assert from "node:assert/strict"

import {createInitialState, reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import type {EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"

test("initial state starts at Boot with no patient content", () => {
  const s = createInitialState()
  assert.equal(s.simulated, true)
  assert.equal(s.phase, "boot")
  assert.equal(s.returnPhase, null)
  assert.equal(s.session, "none")
  assert.equal(s.bedId, null)
  assert.equal(s.verification, "idle")
  assert.deepEqual(s.confirmed, {name: false, dob: false})
  assert.equal(s.scannedPatientId, null)
  assert.equal(s.consent, "unasked")
  assert.equal(s.capture, "idle")
  assert.equal(s.privacy, false)
  assert.equal(s.transcript, "none")
  assert.equal(s.note, null)
  assert.deepEqual(s.noteHistory, [])
  assert.equal(s.handover, null)
  assert.deepEqual(s.view, {
    openCard: null,
    openFlag: null,
    menuOpen: false,
    pending: "none",
    minimised: false,
    miniCorner: "right",
  })
})

test("each call returns a fresh initial state", () => {
  const a = createInitialState()
  const b = createInitialState()
  assert.notEqual(a, b)
  assert.deepEqual(a, b)
})

test("RESET from a state full of encounter content returns the initial state", () => {
  const dirty: EncounterState = {
    ...createInitialState(),
    phase: "handover",
    returnPhase: "review",
    session: "demo",
    bedId: "bed3",
    verification: "verified",
    confirmed: {name: true, dob: true},
    scannedPatientId: "pt-target",
    consent: "granted",
    capture: "stopped",
    privacy: true,
    transcript: "sample",
    note: {version: 2, status: "pendingReview", flags: [{flagId: "site", resolution: "right"}]},
    noteHistory: [
      {version: 1, status: "draft", flags: [{flagId: "site", resolution: null}], outcome: "superseded"},
    ],
    handover: {
      status: "approved",
      source: {version: 2, status: "pendingReview", flags: [{flagId: "site", resolution: "right"}]},
    },
    view: {openCard: "allergy", openFlag: "site", menuOpen: true, pending: "reset", minimised: true, miniCorner: "right"},
  }
  const next = reduce(dirty, {type: "RESET"})
  assert.deepEqual(next, createInitialState())
})

test("RESET does not mutate the previous state", () => {
  const before = createInitialState()
  const dirty: EncounterState = {...before, phase: "round", bedId: "bed3", privacy: true}
  const snapshot = JSON.stringify(dirty)
  reduce(dirty, {type: "RESET"})
  assert.equal(JSON.stringify(dirty), snapshot)
})

test("TICK changes nothing and returns the same state", () => {
  const s = createInitialState()
  assert.equal(reduce(s, {type: "TICK"}), s)
})
