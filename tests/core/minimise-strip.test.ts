import {test} from "node:test"
import assert from "node:assert/strict"
import {createInitialState, reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import type {EncounterEvent, EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {selectDock, selectStatusRail} from "../../Assets/Scripts/Core/EncounterSelectors"
import {VERIFY} from "./helpers"

function run(events: readonly EncounterEvent[], from: EncounterState = createInitialState()): EncounterState {
  return events.reduce((s, e) => reduce(s, e), from)
}

const WARD: readonly EncounterEvent[] = [{type: "START_DEMO"}, {type: "CLOCK_IN"}]
const BED2: readonly EncounterEvent[] = [...WARD, {type: "SELECT_BED", bedId: "bed2"}, ...VERIFY]
const RECORDING: readonly EncounterEvent[] = [...BED2, {type: "OPEN_NOTE"}, {type: "GRANT_CONSENT"}, {type: "START_CAPTURE"}]

test("minimise and restore keep a recording running and the same screen", () => {
  const rec = run(RECORDING)
  assert.equal(rec.capture, "recording")
  const mini = reduce(rec, {type: "MINIMISE"})
  assert.equal(mini.view.minimised, true)
  assert.equal(mini.capture, "recording")
  assert.equal(mini.consent, "granted")
  assert.equal(mini.bodyView, rec.bodyView)
  const back = reduce(mini, {type: "RESTORE"})
  assert.equal(back.view.minimised, false)
  assert.deepEqual({...back, view: rec.view}, rec, "nothing but the view flag changed")
})

test("walking away from the bed still interrupts capture", () => {
  const away = reduce(run(RECORDING), {type: "AWAY_FROM_BED"})
  assert.equal(away.capture, "interrupted")
  assert.equal(away.view.minimised, true)
})

test("minimise is refused at boot and in an emergency, restore when not minimised", () => {
  const boot = createInitialState()
  assert.equal(reduce(boot, {type: "MINIMISE"}), boot)
  const em = run([...BED2, {type: "OPEN_EMERGENCY"}])
  assert.equal(reduce(em, {type: "MINIMISE"}), em)
  const bed2 = run(BED2)
  assert.equal(reduce(bed2, {type: "RESTORE"}), bed2)
  const mini = reduce(bed2, {type: "MINIMISE"})
  assert.equal(reduce(mini, {type: "MINIMISE"}), mini)
})

test("privacy still applies while minimised", () => {
  const mini = run([{type: "MINIMISE"}, {type: "PRIVACY_ON"}], run(RECORDING))
  assert.equal(mini.privacy, true)
  assert.equal(mini.view.minimised, true)
  assert.notEqual(mini.capture, "recording", "privacy ends capture")
  assert.equal(selectStatusRail(mini).strip.patient, "Patient hidden")
})

test("the dock's minimise control becomes Restore while minimised", () => {
  const bed2 = run(BED2)
  assert.equal(selectDock(bed2).minimise.label, "Minimise")
  assert.equal(selectDock(bed2).minimise.enabled, true)
  const mini = reduce(bed2, {type: "MINIMISE"})
  assert.equal(selectDock(mini).minimise.label, "Restore")
  assert.equal(selectDock(mini).minimise.enabled, true)
})

test("Code Blue stays reachable while minimised and restores the dashboard", () => {
  const mini = reduce(run(RECORDING), {type: "MINIMISE"})
  assert.equal(selectDock(mini).emergency.enabled, true)
  const em = reduce(mini, {type: "OPEN_EMERGENCY"})
  assert.equal(em.phase, "emergency")
  assert.equal(em.view.minimised, false)
})
