// AC09: the emergency view holds fixed labelled samples and creates no clinical
// event. Requirements P6.1–P6.5, G09, G12.
import {test} from "node:test"
import assert from "node:assert/strict"

import {reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectEmergency, selectRing, selectStatusRail} from "../../Assets/Scripts/Core/EncounterSelectors"
import {assertNoOp, savedV2, run, ticks} from "./helpers"

test("emergency shows five fixed cards, each with source and time or Unknown", () => {
  const s = reduce(savedV2(), {type: "OPEN_EMERGENCY"})
  const vm = selectEmergency(s)
  assert.equal(vm.active, true)
  assert.equal(vm.visible, true)
  assert.equal(vm.showGate, false)
  assert.deepEqual(
    vm.cards.map((c) => c.label),
    ["Medications", "Code status", "Allergy", "Diagnosis", "Alerts"],
  )
  for (const card of vm.cards) {
    assert.ok(card.value.length > 0)
    if (card.value === "Unknown") assert.equal(card.source, null)
    else assert.ok(card.source && card.time, `${card.label} has source and time`)
  }
  assert.equal(vm.cards[1].value, "Full code", "code status from the sample record (owner round 2)")
  assert.match(vm.cards[0].value, /^Warfarin/, "warfarin is listed first (owner round 2)")
  assert.equal(vm.banner, "Code blue, Bed 3 (simulated drill)")
  assert.equal(selectStatusRail(s).modeLabel, "Emergency mode")
  assert.equal(selectRing(s).mode, "emergency")
})

test("sample vitals are fixed, labelled, sourced, and only out-of-range values are flagged", () => {
  const vm = selectEmergency(reduce(savedV2(), {type: "OPEN_EMERGENCY"}))
  assert.equal(vm.vitalsLabel, "Sample vitals")
  assert.equal(vm.liveNotice, "Simulated playback — not live monitoring")
  const byId = new Map(vm.vitals.map((v) => [v.id, v]))
  assert.equal(byId.get("spo2")?.abnormal, true)
  assert.equal(byId.get("hr")?.abnormal, false)
  assert.equal(byId.get("temp")?.display, "Unknown")
  assert.equal(byId.get("temp")?.abnormal, false)
  for (const v of vm.vitals) {
    if (v.display !== "Unknown") assert.ok(v.source && v.time)
  }
})

test("opening and closing emergency retains existing work without submitting it", () => {
  const before = savedV2()
  const after = run([{type: "OPEN_EMERGENCY"}, ...ticks(50), {type: "CLOSE_EMERGENCY"}], before)
  assert.equal(after.note, null)
  assert.equal(after.phase,"clockIn")
  assert.deepEqual(after.interruptedWork["pt-target"]?.note,before.note)
})

test("values are identical when the view is reopened", () => {
  const first = selectEmergency(reduce(savedV2(), {type: "OPEN_EMERGENCY"}))
  const second = selectEmergency(
    run([{type: "OPEN_EMERGENCY"}, {type: "CLOSE_EMERGENCY"}, ...ticks(20), {type: "OPEN_EMERGENCY"}], savedV2()),
  )
  assert.deepEqual(second, first)
})

test("closing returns to ward overview with no active patient", () => {
  const atReview = savedV2()
  assert.equal(atReview.phase, "review")
  const closed = run([{type: "OPEN_EMERGENCY"}, {type: "CLOSE_EMERGENCY"}], atReview)
  assert.equal(closed.phase, "clockIn")
  assert.equal(closed.bedId,null)
})

test("no alarm, live monitoring or advice wording appears", () => {
  const text = JSON.stringify(selectEmergency(reduce(savedV2(), {type: "OPEN_EMERGENCY"})))
  assert.doesNotMatch(text, /code called/i)
  assert.doesNotMatch(text, /(?<!not )\blive\b/i, "'live' appears only as 'not live'")
  assert.doesNotMatch(text, /recommend|administer|give \d/i)
})

test("playback vitals are deterministic, labelled and hold the last frame (owner round 2, D1)", () => {
  const s = reduce(savedV2(), {type: "OPEN_EMERGENCY"})
  const hr = (sec: number) => selectEmergency(s, sec).vitals.find((v) => v.id === "hr")
  assert.equal(hr(0)?.display, "84")
  assert.equal(hr(9.9)?.display, "84")
  assert.equal(hr(30)?.display, "96")
  assert.equal(hr(30)?.abnormal, true)
  assert.equal(hr(30)?.source, "Simulated playback")
  assert.equal(hr(30)?.time, "Drill +00:30")
  assert.equal(hr(600)?.display, "108", "the last frame holds")
  assert.deepEqual(selectEmergency(s, 42), selectEmergency(s, 42))
  assert.equal(selectEmergency(s, 65).drillTimer, "Drill timer 01:05, not saved")
  assert.equal(selectEmergency(s, 65).vitals.find((v) => v.id === "temp")?.display, "Unknown")
})

test("emergency is read-only: note and handover actions are refused there (owner round 2, 9b)", () => {
  const s = reduce(savedV2(), {type: "OPEN_EMERGENCY"})
  for (const e of [
    {type: "AMEND_NOTE"},
    {type: "SAVE_FOR_REVIEW"},
    {type: "REJECT_DRAFT"},
    {type: "OPEN_FLAG", flagId: "site"},
    {type: "BUILD_HANDOVER"},
    {type: "APPROVE_HANDOVER"},
  ] as const) {
    assertNoOp(s, e)
  }
})

test("emergency wristband confirmation is independent of immediate read-only access", () => {
  const atBrief = run([{type: "START_DEMO"}, {type: "CLOCK_IN"}])
  const open = reduce(atBrief, {type: "OPEN_EMERGENCY"})
  assert.equal(selectEmergency(open).showGate, false)
  assert.equal(selectEmergency(open).visible,true)
  assert.equal(selectEmergency(open).scan.enabled, true)
  const scanned = reduce(open, {type: "EMERGENCY_SCAN"})
  const vm = selectEmergency(scanned)
  assert.equal(vm.showGate, false)
  assert.equal(vm.visible, true)
  assert.equal(vm.banner, "Code blue, Bed 3 (simulated drill)")
  assert.equal(vm.cards[1].value, "Full code")
  assert.equal(scanned.verification, "idle", "the encounter stays unconfirmed")
  assert.equal(scanned.bedId, null)
  assertNoOp(scanned, {type: "EMERGENCY_SCAN"})
  assertNoOp(scanned, {type: "GRANT_CONSENT"})
  assert.deepEqual(reduce(scanned, {type: "CLOSE_EMERGENCY"}), atBrief, "closing clears the scan")
  assert.equal(reduce(reduce(savedV2(), {type:"OPEN_EMERGENCY"}),{type:"EMERGENCY_SCAN"}).emergencyBand,"matched")
  assertNoOp(atBrief, {type: "EMERGENCY_SCAN"})
})
