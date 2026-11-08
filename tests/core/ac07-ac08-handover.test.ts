// AC07: source edits reopen a saved draft and make the prior handover stale.
// AC08: the handover uses saved (pending COW review) sources, keeps unknowns and pending owners, and
// needs its own review. Requirements P5.6, P7.1–P7.5, G06, G07.
import {test} from "node:test"
import assert from "node:assert/strict"

import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectDraft, selectHandover} from "../../Assets/Scripts/Core/EncounterSelectors"
import type {EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {ALL_EVENTS, assertNoOp, draftV1, run, savedV2} from "./helpers"

function atHandover(from: EncounterState): EncounterState {
  return run([{type: "OPEN_HANDOVER"}], from)
}

function builtFromSavedV2(): EncounterState {
  return reduce(atHandover(savedV2()), {type: "BUILD_HANDOVER"})
}

test("AC08: build is refused without a saved note", () => {
  const s = atHandover(draftV1())
  assert.equal(s.phase, "review", "unsaved note cannot enter handover")
  assertNoOp(s, {type: "BUILD_HANDOVER"})
  assert.equal(selectHandover(s).build.enabled, false)
  assert.equal(selectHandover(s).build.reason, "No saved note")
})

test("AC08: every ISBAR line has a source; note lines cite the saved version", () => {
  const s = builtFromSavedV2()
  assert.equal(s.handover?.status, "built")
  assert.equal(s.handover?.source.version, 2)
  const vm = selectHandover(s)
  assert.equal(vm.label, "Handover (simulated)")
  assert.deepEqual(
    [...new Set(vm.lines.map((l) => l.section))],
    ["Identify", "Situation", "Background", "Assessment", "Recommendation"],
  )
  for (const line of vm.lines) assert.ok(line.source.length > 0, `line "${line.text}" has a source`)
  assert.ok(vm.lines.some((l) => l.source === "Note v2 (pending COW review)" && l.text.includes("right hip")))
})

test("AC08: code status comes from the record and pending tasks keep their owners", () => {
  const vm = selectHandover(builtFromSavedV2())
  assert.ok(vm.lines.some((l) => l.text === "Code status: Full code"))
  assert.equal(vm.tasks.length, 2)
  for (const task of vm.tasks) {
    assert.equal(task.status, "Pending")
    assert.ok(task.owner.length > 0)
  }
})

test("AC08: no event marks a pending task done", () => {
  let s = builtFromSavedV2()
  for (const e of ALL_EVENTS) {
    if (e.type === "RESET" || e.type === "CONFIRM_PENDING") continue
    s = reduce(s, e)
    if (s.handover) for (const task of selectHandover(s).tasks) assert.equal(task.status, "Pending")
  }
})

test("AC08: handover approval is separate and does not change the note", () => {
  const built = builtFromSavedV2()
  const approved = reduce(built, {type: "APPROVE_HANDOVER"})
  assert.equal(approved.handover?.status, "approved")
  assert.deepEqual(approved.note, built.note)
  assert.deepEqual(approved.noteHistory, built.noteHistory)
  assert.equal(selectHandover(approved).message, "Handover approved. Not sent (simulated).")
  // Saving the note never approves the handover.
  assertNoOp(built, {type: "SAVE_FOR_REVIEW"})
  assert.equal(built.handover?.status, "built")
})

test("AC08: a rejected note cannot support a handover", () => {
  const s = atHandover(reduce(draftV1(), {type: "REJECT_DRAFT"}))
  assertNoOp(s, {type: "BUILD_HANDOVER"})
})

test("AC07: amending a saved note creates v3, reopens it and stales the handover", () => {
  const approvedHandover = reduce(builtFromSavedV2(), {type: "APPROVE_HANDOVER"})
  const s = reduce(approvedHandover, {type: "AMEND_NOTE"})
  assert.equal(s.note?.version, 3)
  assert.equal(s.note?.status, "edited")
  assert.equal(s.note?.flags[0].resolution, null, "the amended item is reopened")
  assert.equal(s.view.openFlag, "site")
  assert.equal(s.handover?.status, "stale")
  assert.equal(s.handover?.source.version, 2)
  const last = s.noteHistory[s.noteHistory.length - 1]
  assert.deepEqual(
    {version: last.version, status: last.status, outcome: last.outcome},
    {version: 2, status: "pendingReview", outcome: "superseded"},
  )
  assertNoOp(s, {type: "SAVE_FOR_REVIEW"})
  assertNoOp(s, {type: "APPROVE_HANDOVER"})
  const ho = selectHandover(s)
  assert.equal(ho.message, "Stale: a source changed. Rebuild before approval.")
  assert.equal(ho.approve.enabled, false)
})

test("AC07: correcting the amendment edits v3 in place; save then rebuild cites v3", () => {
  const amended = reduce(builtFromSavedV2(), {type: "AMEND_NOTE"})
  const corrected = reduce(amended, {type: "CORRECT_DRAFT", flagId: "site", optionId: "unknown"})
  assert.equal(corrected.note?.version, 3)
  assert.equal(corrected.note?.status, "edited")
  assert.equal(corrected.note?.flags[0].resolution, "unknown")
  assert.ok(selectDraft(corrected).lines.some((l) => l.includes("site Unknown")))
  const signed = reduce(corrected, {type: "SAVE_FOR_REVIEW"})
  assert.equal(signed.handover?.status, "stale", "saving does not refresh the handover")
  assertNoOp(signed, {type: "APPROVE_HANDOVER"})
  const rebuilt = reduce(signed, {type: "BUILD_HANDOVER"})
  assert.equal(rebuilt.handover?.status, "built")
  assert.equal(rebuilt.handover?.source.version, 3)
  assert.ok(selectHandover(rebuilt).lines.some((l) => l.source === "Note v3 (pending COW review)"))
  assert.equal(reduce(rebuilt, {type: "APPROVE_HANDOVER"}).handover?.status, "approved")
})

test("AC07: a stale handover keeps showing the old source until rebuilt", () => {
  const s = reduce(builtFromSavedV2(), {type: "AMEND_NOTE"})
  const vm = selectHandover(s)
  assert.equal(vm.status, "stale")
  assert.ok(vm.lines.some((l) => l.source === "Note v2 (pending COW review)"))
})

test("AC07: amend is refused unless the note is saved", () => {
  assertNoOp(draftV1(), {type: "AMEND_NOTE"})
})
