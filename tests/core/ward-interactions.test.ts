import {test} from "node:test"
import assert from "node:assert/strict"
import {createInitialState, reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import type {EncounterEvent, EncounterState} from "../../Assets/Scripts/Core/EncounterTypes"
import {bedGeometry, bedPoint, destinationCue, horizontalDistance} from "../../Assets/Scripts/Core/WardGeometry"
import type {BedPose, CameraPose, Point3} from "../../Assets/Scripts/Core/WardGeometry"
import {createWardInteraction, observeWardEvent, stepWardInteraction} from "../../Assets/Scripts/Core/WardInteraction"
import type {WardInteractionState} from "../../Assets/Scripts/Core/WardInteraction"
import {createSpatialMotion, setSpatialVisibility, spatialMotionView, stepSpatialMotion} from "../../Assets/Scripts/Core/SpatialMotion"
import {createWardPresentation, stepWardPresentation, wardPresentationViews} from "../../Assets/Scripts/Core/WardPresentation"
import {CORRECT_RIGHT, run, TO_TRANSCRIPT, VERIFY} from "./helpers"

const beds: readonly BedPose[] = [
  {bedId: "bed1", position: [0, 65, 0], yawDegrees: 0},
  {bedId: "bed2", position: [150, 65, 0], yawDegrees: 0},
  {bedId: "bed3", position: [400, 65, -200], yawDegrees: 0},
  {bedId: "bed4", position: [700, 65, -200], yawDegrees: 0},
]
const ward = () => run([{type: "START_DEMO"}, {type: "CLOCK_IN"}])
const verified = () => run([{type: "SELECT_BED", bedId: "bed2"}, ...VERIFY], ward())
const draft = () => run(TO_TRANSCRIPT, verified())
function camera(position: Point3 = [150, 160, 165]): CameraPose {
  return {position, forward: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], verticalFovDegrees: 60, aspect: 0.75}
}
function step(state = createWardInteraction(), encounter = ward(), position: Point3 = [150, 160, 165], dt = 0,
  options: {draftVisible?: boolean; beds?: readonly BedPose[]} = {}) {
  return stepWardInteraction(state, {encounter, camera: camera(position), beds: options.beds ?? beds,
    deltaSeconds: dt, draftVisible: options.draftVisible ?? false})
}
function accepted(state: WardInteractionState, encounter: EncounterState, event: EncounterEvent) {
  const next = reduce(encounter, event)
  return {state: observeWardEvent(state, event, encounter, next), encounter: next}
}
function nearPoint(index: number): Point3 {
  const p = bedGeometry(beds[index]).approach
  return [p[0], 160, p[2]]
}

test("authored yaw rotates every anchor and preserves the closed bed footprint", () => {
  const pose: BedPose = {bedId: "bed2", position: [100, 65, 200], yawDegrees: 90}
  const g = bedGeometry(pose)
  assert.ok(Math.abs(g.approach[0] - 265) < 1e-10)
  assert.ok(Math.abs(g.approach[2] - 200) < 1e-10)
  assert.equal(g.outline.length, 5)
  assert.deepEqual(g.outline[0], g.outline[4])
  assert.ok(Math.abs(horizontalDistance(g.outline[0], g.outline[1]) - 110) < 1e-10)
  assert.ok(Math.abs(horizontalDistance(g.outline[1], g.outline[2]) - 220) < 1e-10)
  const mirrored = bedGeometry(pose, true)
  assert.notDeepEqual(g.board, mirrored.board)
  assert.deepEqual(g.wrist, mirrored.wrist)
  assert.deepEqual(bedPoint({...pose, yawDegrees: 0}, [1, 2, 3]), [101, 67, 203])
  const measured = bedGeometry({...pose, footprintCm: [90, 200]})
  assert.ok(Math.abs(horizontalDistance(measured.outline[0], measured.outline[1]) - 90) < 1e-10)
  assert.ok(Math.abs(horizontalDistance(measured.outline[1], measured.outline[2]) - 200) < 1e-10)
  const unrotated: BedPose = {...pose, yawDegrees: 0}
  assert.ok(bedGeometry(unrotated).board[0] - pose.position[0] - 16 >= 55 + 10)
  assert.ok(bedGeometry(unrotated, true).board[0] - pose.position[0] + 16 <= -55 - 10)
  assert.ok(bedGeometry(unrotated, false, 60).board[0] - pose.position[0] - 30 >= 55 + 10)
})

test("horizontal proximity ignores eye height and rejects invalid positions", () => {
  assert.equal(horizontalDistance([0, 1000, 0], [3, -1000, 4]), 5)
  assert.equal(horizontalDistance([NaN, 0, 0], [0, 0, 0]), Infinity)
  assert.equal(step(undefined, ward(), [150, 300, 165]).state.previewBed, "bed2")
})

test("each of the four beds reveals only its own de-identified preview", () => {
  for (let i = 0; i < beds.length; i++) {
    const result = step(undefined, ward(), nearPoint(i))
    assert.equal(result.state.previewBed, beds[i].bedId)
    assert.equal(result.beds.filter(b => b.state === "preview").length, 1)
    assert.equal(result.events.length, 0, "approach never selects or verifies")
    assert.equal(result.surface, "none")
    const preview = result.beds.find(b => b.state === "preview")!
    assert.ok(preview.nextNeed.length > 0)
    assert.ok(!("patientId" in preview) && !("name" in preview))
  }
})

test("preview enter and exit hysteresis include the exact boundary policy", () => {
  const only = [beds[0]]
  let result = step(undefined, ward(), [140, 160, 165], 0, {beds: only})
  assert.equal(result.state.previewBed, null)
  result = step(result.state, ward(), [139.9, 160, 165], 0, {beds: only})
  assert.equal(result.state.previewBed, "bed1")
  result = step(result.state, ward(), [170, 160, 165], 0, {beds: only})
  assert.equal(result.state.previewBed, "bed1")
  result = step(result.state, ward(), [170.1, 160, 165], 0, {beds: only})
  assert.equal(result.state.previewBed, null)
})

test("competing bed needs a 20 cm advantage for 250 continuous milliseconds", () => {
  let result = step(undefined, ward(), [20, 160, 165])
  assert.equal(result.state.previewBed, "bed1")
  result = step(result.state, ward(), [100, 160, 165], 0.1)
  result = step(result.state, ward(), [100, 160, 165], 0.149)
  assert.equal(result.state.previewBed, "bed1")
  result = step(result.state, ward(), [100, 160, 165], 0.001)
  assert.equal(result.state.previewBed, "bed2")
})

test("losing the challenger advantage resets its dwell and ties stay stable", () => {
  let result = step(undefined, ward(), [20, 160, 165])
  result = step(result.state, ward(), [100, 160, 165], 0.2)
  result = step(result.state, ward(), [75, 160, 165], 0.2)
  assert.equal(result.state.challenger, null)
  result = step(result.state, ward(), [100, 160, 165], 0.1)
  assert.equal(result.state.previewBed, "bed1")
})

test("distant selection gives direction and blocks scan until the intended bed is near", () => {
  const selected = reduce(ward(), {type: "SELECT_BED", bedId: "bed2"})
  const far = step(undefined, selected, [700, 160, 165])
  assert.equal(far.surface, "destination")
  assert.equal(far.canScan, false)
  assert.equal(far.targetBed, "bed2")
  assert.equal(far.beds.filter(b => b.selectable).length, 0)
  assert.equal(far.beds.find(b => b.bedId === "bed4")?.state, "hidden")
  const near = step(far.state, selected)
  assert.equal(near.surface, "verification")
  assert.equal(near.canScan, true)
  assert.equal(near.events.length, 0)
})

test("both deliberate identifier confirmations lead directly to bedside presentation", () => {
  const s = verified()
  assert.equal(step(undefined, s).surface, "bedside")
  assert.equal(step(undefined, s).canScan, false)
})

test("leaving interrupts capture; returning restores distance collapse without capture", () => {
  let encounter = run([{type: "OPEN_NOTE"}, {type: "GRANT_CONSENT"}, {type: "START_CAPTURE"}], verified())
  let result = step(undefined, encounter)
  result = step(result.state, encounter, [1000, 160, 165])
  assert.deepEqual(result.events, [{type: "AWAY_FROM_BED"}])
  encounter = reduce(encounter, result.events[0])
  assert.equal(encounter.capture, "interrupted")
  result = step(result.state, encounter)
  assert.deepEqual(result.events, [{type: "NEAR_BED"}])
  encounter = reduce(encounter, result.events[0])
  assert.equal(encounter.view.minimised, false)
  assert.equal(encounter.capture, "interrupted")
})

test("manual minimisation survives leaving and returning until deliberate Restore", () => {
  const a = accepted(step(undefined, verified()).state, verified(), {type: "MINIMISE"})
  const away = step(a.state, a.encounter, [1000, 160, 165])
  const back = step(away.state, a.encounter)
  assert.equal(back.state.collapseReason, "manual")
  assert.equal(back.surface, "compact")
  assert.equal(back.events.length, 0)
  const restored = accepted(back.state, a.encounter, {type: "RESTORE"})
  assert.equal(step(restored.state, restored.encounter).surface, "bedside")
})

test("unknown legacy minimisation is never automatically restored", () => {
  const s = reduce(verified(), {type: "MINIMISE"})
  assert.equal(step(undefined, s).events.length, 0)
  assert.equal(step(undefined, s).surface, "compact")
})

test("privacy hides every bed, cue and scan action, including during emergency", () => {
  for (const encounter of [verified(), reduce(verified(), {type: "OPEN_EMERGENCY"})]) {
    const result = step(undefined, reduce(encounter, {type: "PRIVACY_ON"}))
    assert.ok(result.beds.every(b => b.state === "hidden" && !b.selectable))
    assert.equal(result.surface, "none")
    assert.equal(result.cue, null)
    assert.equal(result.canScan, false)
    assert.equal(result.events.length, 0)
  }
})

test("emergency exclusively highlights Bed 3 before and after arrival", () => {
  let encounter = reduce(verified(), {type: "OPEN_EMERGENCY"})
  const far = step(undefined, encounter)
  assert.equal(far.surface, "emergencyTravel")
  assert.deepEqual(far.beds.filter(b => b.state !== "hidden").map(b => [b.bedId, b.state]), [["bed3", "emergency"]])
  const near = step(far.state, encounter, nearPoint(2))
  assert.equal(near.surface, "emergencyBedside")
  assert.deepEqual(near.events, [{type: "EMERGENCY_NEAR"}])
  encounter = run([...near.events, {type: "EMERGENCY_CONTACT"}], encounter)
  const away = step(near.state, encounter)
  assert.deepEqual(away.events, [{type: "EMERGENCY_AWAY"}])
  const after = reduce(encounter, away.events[0])
  assert.equal(after.emergencyContact, true)
  assert.equal(after.emergencyPatientId, "pt-target")
})

test("frustum cue distinguishes visible, left, right, above, below and behind", () => {
  const c = camera([0, 0, 0])
  assert.equal(destinationCue(c, [0, 0, -200])?.kind, "marker")
  assert.equal(destinationCue(c, [-300, 0, -200])?.direction, "left")
  assert.equal(destinationCue(c, [300, 0, -200])?.direction, "right")
  assert.equal(destinationCue(c, [0, 300, -200])?.direction, "up")
  assert.equal(destinationCue(c, [0, -300, -200])?.direction, "down")
  assert.equal(destinationCue(c, [0, 0, 200])?.kind, "direction")
  const turned = {...c, forward: [1, 0, 0] as Point3, right: [0, 0, 1] as Point3}
  assert.equal(destinationCue(turned, [200, 0, 0])?.kind, "marker")
  assert.equal(destinationCue({...c, verticalFovDegrees: NaN}, [0, 0, -200]), null)
  const result = step(undefined, ward(), [150, 160, -1000])
  assert.ok(result.beds.every(b => !b.markerVisible && !b.selectable), "off-screen bed controls cannot receive selection")
})

test("missing and duplicate anchors never fall back to another bed", () => {
  const encounter = reduce(verified(), {type: "OPEN_EMERGENCY"})
  for (const registry of [beds.filter(b => b.bedId !== "bed3"), [...beds, beds[2]],
    beds.map(b => b.bedId === "bed3" ? {...b, yawDegrees: NaN} : b)]) {
    const result = step(undefined, encounter, nearPoint(2), 0, {beds: registry})
    assert.equal(result.surface, "emergencyTravel")
    assert.equal(result.cue, null)
    assert.ok(!result.beds.some(b => b.state === "emergency"))
  }
})

test("only a visible first Bed 2 draft arms the five-second scripted drill", () => {
  assert.equal(step(undefined, verified(), undefined, 10, {draftVisible: true}).state.drill, "armed")
  assert.equal(step(undefined, draft(), undefined, 10).state.drill, "armed")
  let result = step(undefined, draft(), undefined, 10, {draftVisible: true})
  assert.equal(result.drillCountdown, 5, "time before first presentation is not counted")
  result = step(result.state, draft(), undefined, 4.9)
  assert.equal(result.events.length, 0)
  result = step(result.state, draft(), undefined, 0.1)
  assert.deepEqual(result.events, [{type: "OPEN_EMERGENCY"}])
  assert.equal(result.state.drill, "consumed")
  assert.equal(step(result.state, draft(), undefined, 100).events.length, 0)
})

test("script timer pauses for privacy and menus without modifying the draft", () => {
  const s = draft(), result = step(undefined, s, undefined, 0, {draftVisible: true})
  const p = reduce(s, {type: "PRIVACY_ON"})
  const paused = step(result.state, p, undefined, 100)
  assert.equal(paused.drillCountdown, 5)
  const m = reduce(s, {type: "TOGGLE_MENU"})
  assert.equal(step(paused.state, m, undefined, 100).drillCountdown, 5)
  assert.equal(s.note?.status, "draft")
  assert.equal(s.note?.flags[0].resolution, null)
})

test("switch cancels the script; reset rearms it; rejected events change nothing", () => {
  let s = draft(), state = step(undefined, s, undefined, 0, {draftVisible: true}).state
  assert.equal(observeWardEvent(state, {type: "RESET"}, s, s), state)
  s = run([{type: "TOGGLE_MENU"}, {type: "REQUEST_SWITCH"}], s)
  const switched = accepted(state, s, {type: "CONFIRM_PENDING"})
  assert.equal(switched.state.drill, "consumed")
  assert.equal(step(switched.state, draft(), undefined, 100, {draftVisible: true}).events.length, 0)
  const reset = accepted(switched.state, switched.encounter, {type: "RESET"})
  assert.equal(reset.state.drill, "armed")
  state = step(reset.state, draft(), undefined, 0, {draftVisible: true}).state
  assert.equal(state.drill, "counting")
})

test("manual emergency consumes pending script and closing cannot retrigger it", () => {
  const s = draft(), started = step(undefined, s, undefined, 0, {draftVisible: true})
  const opened = accepted(started.state, s, {type: "OPEN_EMERGENCY"})
  assert.equal(opened.state.drill, "consumed")
  const closed = accepted(opened.state, opened.encounter, {type: "CLOSE_EMERGENCY"})
  assert.equal(step(closed.state, draft(), undefined, 100, {draftVisible: true}).events.length, 0)
})

test("scripted interruption preserves unresolved work and requires reverify plus explicit reopen", () => {
  const s = draft(), armed = step(undefined, s, undefined, 0, {draftVisible: true})
  const result = step(armed.state, s, undefined, 5)
  const emergency = reduce(s, result.events[0])
  assert.equal(emergency.note, null)
  assert.equal(emergency.interruptedWork["pt-bed2"]?.note?.status, "draft")
  assert.equal(emergency.interruptedWork["pt-bed2"]?.note?.flags[0].resolution, null)
  assert.equal(emergency.scannedPatientId, null)
  const returned = run([{type: "CLOSE_EMERGENCY"}, {type: "SELECT_BED", bedId: "bed2"}, ...VERIFY], emergency)
  assert.equal(returned.note, null)
  const reopened = reduce(returned, {type: "REOPEN_WORK"})
  assert.equal(reopened.note?.version, s.note?.version)
  assert.equal(reopened.consent, "unasked")
  assert.equal(reopened.capture, "idle")
})

test("all automatic events are limited to proximity and the drill, never documentation", () => {
  const allowed = new Set(["AWAY_FROM_BED", "NEAR_BED", "EMERGENCY_NEAR", "EMERGENCY_AWAY", "OPEN_EMERGENCY"])
  const samples = [createInitialState(), ward(), verified(), draft(), run(CORRECT_RIGHT, draft()),
    reduce(verified(), {type: "OPEN_EMERGENCY"})]
  for (const encounter of samples) for (const position of [[0, 160, 0], nearPoint(2), [1000, 160, 165]] as Point3[]) {
    const first = step(undefined, encounter, position, 0, {draftVisible: true})
    const result = step(first.state, encounter, position, 10)
    assert.ok(result.events.every(e => allowed.has(e.type)))
  }
})

test("reveals and dismissals settle within 180/120 ms without overshoot", () => {
  let motion = setSpatialVisibility(createSpatialMotion(), true)
  motion = stepSpatialMotion(motion, 0.09)
  assert.ok(motion.progress > 0 && motion.progress < 1)
  assert.equal(spatialMotionView(motion).controlsEnabled, false)
  motion = stepSpatialMotion(motion, 0.09)
  assert.equal(motion.progress, 1)
  assert.equal(spatialMotionView(motion).controlsEnabled, true)
  motion = setSpatialVisibility(motion, false)
  assert.equal(spatialMotionView(motion).controlsEnabled, false, "dismissal disables input immediately")
  motion = stepSpatialMotion(motion, 0.12)
  assert.equal(spatialMotionView(motion).render, false)
  assert.equal(motion.progress, 0)
})

test("reduced motion and priority interrupts settle immediately; reversals remain bounded", () => {
  let motion = stepSpatialMotion(setSpatialVisibility(createSpatialMotion(), true), 0.06)
  const reduced = setSpatialVisibility(motion, true, true)
  assert.equal(reduced.progress, 1)
  assert.equal(setSpatialVisibility(motion, false, false, true).progress, 0)
  for (let i = 0; i < 20; i++) {
    motion = stepSpatialMotion(setSpatialVisibility(motion, i % 2 === 0), 0.03)
    const view = spatialMotionView(motion)
    assert.ok(view.opacity >= 0 && view.opacity <= 1)
    assert.ok(view.offsetCm >= 0 && view.offsetCm <= 1)
  }
  assert.deepEqual(stepSpatialMotion(motion, NaN), motion)
})

test("twenty approach/leave cycles preserve one selection and never create domain work", () => {
  let encounter = verified(), state = createWardInteraction()
  for (let i = 0; i < 20; i++) {
    for (const position of [[1000, 160, 165], nearPoint(1)] as Point3[]) {
      const result = step(state, encounter, position)
      state = result.state
      for (const event of result.events) {
        const next = reduce(encounter, event)
        state = observeWardEvent(state, event, encounter, next)
        encounter = next
      }
      assert.equal(result.beds.filter(b => b.state === "selected").length, 1)
      assert.equal(encounter.bedId, "bed2")
      assert.equal(encounter.note, null)
      assert.equal(encounter.capture, "idle")
    }
  }
})

test("emergency preempts moving routine content and shows only the target immediately", () => {
  const options = {privacy: false, reducedMotion: false}
  let presentation = stepWardPresentation(createWardPresentation(), step(undefined, verified()), 0.03, options)
  assert.ok(presentation.surface.progress < 1)
  const emergency = step(undefined, reduce(verified(), {type: "OPEN_EMERGENCY"}))
  presentation = stepWardPresentation(presentation, emergency, 0, options)
  assert.equal(presentation.surface.progress, 1)
  const views = wardPresentationViews(presentation)
  assert.deepEqual(views.beds.filter(b => b.render).map(b => b.bedId), ["bed3"])
  assert.equal(views.beds.find(b => b.bedId === "bed2")?.controlsEnabled, false)
})

test("privacy and reset immediately retire all moving surfaces and colliders", () => {
  const frame = step(undefined, verified())
  const presentation = stepWardPresentation(createWardPresentation(), frame, 0.03, {privacy: false, reducedMotion: false})
  for (const options of [{privacy: true, reducedMotion: false}, {privacy: false, reducedMotion: false, reset: true}]) {
    const hidden = wardPresentationViews(stepWardPresentation(presentation, frame, 0, options))
    assert.equal(hidden.surface.render, false)
    assert.ok(hidden.beds.every(b => !b.render && !b.controlsEnabled))
  }
})

test("reduced motion applies to every bed and the active surface together", () => {
  const result = step(undefined, verified())
  const views = wardPresentationViews(stepWardPresentation(createWardPresentation(), result, 0, {privacy: false, reducedMotion: true}))
  assert.equal(views.surface.opacity, 1)
  assert.equal(views.surface.offsetCm, 0)
  assert.ok(views.beds.filter(b => b.render).every(b => b.offsetCm === 0 && b.opacity === 1))
})

test("repeated same-surface updates do not restart motion; twenty cycles keep fixed bed storage", () => {
  const options = {privacy: false, reducedMotion: false}, result = step(undefined, verified())
  let presentation = createWardPresentation()
  for (let i = 0; i < 20; i++) {
    presentation = stepWardPresentation(presentation, result, 0.01, options)
    assert.equal(Object.keys(presentation.beds).length, 4)
  }
  assert.equal(presentation.surface.progress, 1)
  const g = step(undefined, reduce(verified(), {type: "OPEN_EMERGENCY"}))
  for (let i = 0; i < 20; i++) {
    presentation = stepWardPresentation(presentation, i % 2 ? result : g, 0.01, options)
    assert.equal(Object.keys(presentation.beds).length, 4)
    assert.ok(wardPresentationViews(presentation).beds.every(b => b.opacity >= 0 && b.opacity <= 1))
  }
})
