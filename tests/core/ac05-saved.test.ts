// AC05 (reworded, owner round 2): the glasses never sign or file. A reviewed draft
// is saved as "Draft saved, pending review on COW" only by the deliberate save, and
// nothing on the device claims the note was filed or signed.
import {test} from "node:test"
import assert from "node:assert/strict"
import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import * as Sel from "../../Assets/Scripts/Core/EncounterSelectors"
import {ALL_EVENTS, assertNoOp, CORRECT_RIGHT, draftV1, run, savedV2, trace} from "./helpers"

test("saving needs a resolved draft", () => {
  const v1 = draftV1()
  assertNoOp(v1, {type: "SAVE_FOR_REVIEW"})
  const v2 = run(CORRECT_RIGHT, v1)
  assert.equal(Sel.selectDraft(v2).save.enabled, true)
})

test("the saved draft reads pending review on the COW and cannot be saved twice", () => {
  const s = savedV2()
  assert.equal(s.note?.status, "pendingReview")
  const vm = Sel.selectDraft(s)
  assert.equal(vm.saved, true)
  assert.equal(vm.statusLabel, "Draft saved, pending review on COW")
  assert.equal(vm.save.enabled, false)
  assert.equal(vm.save.reason, "Already saved for COW review")
  assertNoOp(s, {type: "SAVE_FOR_REVIEW"})
})

test("no state has a signing or filing field, and no event signs or files", () => {
  for (const s of trace([...ALL_EVENTS, ...ALL_EVENTS], savedV2())) {
    assert.ok(!("filing" in s), "no filing state")
    assert.ok(!("cow" in s), "no COW login state")
    assert.notEqual(s.note?.status as string, "approved")
  }
})

test("no draft or handover text claims the note was filed, signed or sent", () => {
  const states = trace([{type: "NAV_NEXT"}, {type: "NAV_NEXT"}, {type: "BUILD_HANDOVER"}], savedV2())
  const text = JSON.stringify(states.map((s) => [Sel.selectDraft(s), Sel.selectHandover(s), Sel.selectStatusRail(s)]))
  assert.doesNotMatch(text, /\bfiled\b|\bsigned\b|\bsign\b|EHR/i)
  assert.doesNotMatch(text, /was sent|has been sent|sent to/i)
})

test("an approved-handover action leaves the saved note untouched", () => {
  const built = reduce(run([{type: "NAV_NEXT"}, {type: "NAV_NEXT"}], savedV2()), {type: "BUILD_HANDOVER"})
  const next = reduce(built, {type: "APPROVE_HANDOVER"})
  assert.deepEqual(next.note, built.note)
})
