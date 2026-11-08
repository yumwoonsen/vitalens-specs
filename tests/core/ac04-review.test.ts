// AC04: the draft can be inspected, corrected and rejected; only the deliberate
// "Save for COW review" changes its status (owner round 2: no signing on the glasses). Navigation and timer bypass attempts fail.
// Requirements P4.6, P5.1–P5.4, G05.
import {test} from "node:test"
import assert from "node:assert/strict"

import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectDraft, selectHandover} from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {assertNoOp, CORRECT_RIGHT, draftV1, NAVIGATION_AND_VIEW, run, ticks} from "./helpers"

function encounterRecord(s: EncounterState) {
  return {note: s.note, noteHistory: s.noteHistory, handover: s.handover}
}

test("draft v1 is labelled, not saved, and carries the seeded flag with its evidence", () => {
  const s = draftV1()
  assert.deepEqual(s.note, {version: 1, status: "draft", flags: [{flagId: "site", resolution: null}]})
  const vm = selectDraft(s)
  assert.equal(vm.visible, true)
  assert.equal(vm.label, "Draft (simulated AI)")
  assert.equal(vm.statusLabel, "Draft, not saved")
  assert.equal(vm.version, 1)
  assert.ok(vm.lines.some((l) => l.includes("left hip")), "the seeded error is in the draft")
  assert.equal(vm.flags.length, 1)
  assert.equal(vm.flags[0].resolved, false)
  assert.match(vm.flags[0].evidence, /right hip/)
})

test("saving is refused while a flag is unresolved", () => {
  const s = draftV1()
  assertNoOp(s, {type: "SAVE_FOR_REVIEW"})
  assert.equal(selectDraft(s).save.enabled, false)
  assert.equal(selectDraft(s).save.reason, "Resolve flagged items first")
})

test("the pick list has at most 4 options including Unknown", () => {
  const s = reduce(draftV1(), {type: "OPEN_FLAG", flagId: "site"})
  const pick = selectDraft(s).pickList
  assert.ok(pick)
  assert.ok(pick.options.length <= 4)
  assert.ok(pick.options.some((o) => o.label === "Unknown"))
})

test("a correction resolves the flag and creates v2 Edited; v1 stays in history", () => {
  const s = run(CORRECT_RIGHT, draftV1())
  assert.deepEqual(s.note, {version: 2, status: "edited", flags: [{flagId: "site", resolution: "right"}]})
  assert.equal(s.view.openFlag, null)
  assert.equal(s.noteHistory.length, 1)
  assert.equal(s.noteHistory[0].version, 1)
  assert.equal(s.noteHistory[0].outcome, "superseded")
  const vm = selectDraft(s)
  assert.equal(vm.statusLabel, "Edited, not saved")
  assert.ok(vm.lines.some((l) => l.includes("right hip")))
  assert.ok(!vm.lines.some((l) => l.includes("left hip")))
  assert.equal(vm.save.enabled, true)
})

test("closing the pick list leaves the flag unresolved", () => {
  const s = run([{type: "OPEN_FLAG", flagId: "site"}, {type: "CLOSE_FLAG"}], draftV1())
  assert.equal(s.note?.flags[0].resolution, null)
  assert.equal(s.note?.version, 1)
})

test("a correction needs the pick list open", () => {
  assertNoOp(draftV1(), {type: "CORRECT_DRAFT", flagId: "site", optionId: "right"})
})

test("navigation bypass: Next, Back, emergency, menu, privacy and minimise never change the draft", () => {
  const start = draftV1()
  const end = run(NAVIGATION_AND_VIEW, start)
  assert.deepEqual(encounterRecord(end), encounterRecord(start))
  assert.equal(end.note?.status, "draft")
  assert.equal(end.note?.version, 1)
  // Build handover stays disabled with no saved note.
  assert.equal(selectHandover(end).build.enabled, false)
})

test("navigation bypass on a ready-to-save draft: still Edited until Save for COW review", () => {
  const ready = run(CORRECT_RIGHT, draftV1())
  const end = run([...NAVIGATION_AND_VIEW, ...NAVIGATION_AND_VIEW], ready)
  assert.equal(end.note?.status, "edited")
  assert.deepEqual(encounterRecord(end), encounterRecord(ready))
})

test("timer bypass: elapsed-time ticks change nothing", () => {
  const ready = run(CORRECT_RIGHT, draftV1())
  let s = ready
  for (const e of ticks(1000)) s = reduce(s, e)
  assert.equal(s, ready, "TICK returns the same state object")
})

test("only SAVE_FOR_REVIEW marks the draft pending review on the COW", () => {
  const ready = run(CORRECT_RIGHT, draftV1())
  const saved = reduce(ready, {type: "SAVE_FOR_REVIEW"})
  assert.equal(saved.note?.status, "pendingReview")
  assert.equal(saved.note?.version, 2)
  assert.equal(selectDraft(saved).statusLabel, "Draft saved, pending review on COW")
})

test("reject: a rejected draft cannot be saved or used for handover", () => {
  const s = reduce(draftV1(), {type: "REJECT_DRAFT"})
  assert.equal(s.note?.status, "rejected")
  assert.equal(selectDraft(s).statusLabel, "Rejected")
  assertNoOp(s, {type: "SAVE_FOR_REVIEW"})
  assertNoOp(s, {type: "BUILD_HANDOVER"})
  assertNoOp(s, {type: "OPEN_FLAG", flagId: "site"})
})

test("an edited draft can also be rejected", () => {
  const s = run([...CORRECT_RIGHT, {type: "REJECT_DRAFT"}], draftV1())
  assert.equal(s.note?.status, "rejected")
})

test("start a new capture after reject keeps consent, clears the draft and keeps history", () => {
  const s = run([{type: "REJECT_DRAFT"}, {type: "NEW_CAPTURE"}], draftV1())
  assert.equal(s.note, null)
  assert.equal(s.transcript, "none")
  assert.equal(s.capture, "idle")
  assert.equal(s.consent, "granted")
  assert.equal(s.noteHistory.length, 1)
  assert.equal(s.noteHistory[0].outcome, "rejected")
  // A new draft takes the next version number.
  const again = run([{type: "START_CAPTURE"}, {type: "STOP_CAPTURE"}, {type: "GENERATE_DRAFT"}], s)
  assert.equal(again.note?.version, 2)
  assert.equal(again.note?.status, "draft")
})

test("draft generation needs a transcript and no existing draft", () => {
  const s = draftV1()
  assertNoOp(s, {type: "GENERATE_DRAFT"})
})
