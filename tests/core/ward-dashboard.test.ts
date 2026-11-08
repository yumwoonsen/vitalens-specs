import {test} from "node:test"
import assert from "node:assert/strict"
import {dashboardPose, WARD_LAYOUT} from "../../Assets/Scripts/Core/WardLayout"

// Authored bed centres, from ward-layout.json.
const LEFT_ROW = [[-204, -95, -455], [-204, -95, -165]] as const
const RIGHT_ROW = [[204, -95, -165], [204, -95, -455]] as const
const BEDS = [...LEFT_ROW, ...RIGHT_ROW]
const D = WARD_LAYOUT.dashboard
const EDGE = D.bedHalfWidthCm

function nearEdgeGap(bed: readonly [number, number, number]): number {
  const {position, yaw} = dashboardPose(bed)
  const towardsAisle = bed[0] < D.aisleX ? 1 : -1
  const nearEdge = position[0] - towardsAisle * D.panelHalfWidthCm * Math.abs(Math.cos(yaw))
  return towardsAisle * (nearEdge - (bed[0] + towardsAisle * EDGE))
}

test("left-row dashboards are to the right of the head and right-row to the left: towards the aisle", () => {
  for (const bed of LEFT_ROW) assert.ok(dashboardPose(bed).position[0] > bed[0] + EDGE)
  for (const bed of RIGHT_ROW) assert.ok(dashboardPose(bed).position[0] < bed[0] - EDGE)
})

test("the side is decided by position against the aisle, not by the bed number", () => {
  assert.equal(Math.sign(dashboardPose([-1, -95, -165]).position[0] - -1), 1)
  assert.equal(Math.sign(dashboardPose([1, -95, -165]).position[0] - 1), -1)
})

test("every panel is level with the head at torso height, with a 15 to 25 cm gap to the bed", () => {
  for (const bed of BEDS) {
    const {position} = dashboardPose(bed)
    assert.equal(position[2], bed[2] + D.head[2])
    assert.equal(position[1], D.panelY)
    assert.ok(D.eyeY - D.panelY >= 35 && D.eyeY - D.panelY <= 45, "35 to 45 cm below the eye")
    const gap = nearEdgeGap(bed)
    assert.ok(gap >= 15 && gap <= 25, `gap ${gap}`)
  }
})

test("every panel faces the nurse's standing point on the aisle side, level with the wrist", () => {
  for (const bed of BEDS) {
    const {position: at, stand, yaw} = dashboardPose(bed)
    const towardsAisle = bed[0] < D.aisleX ? 1 : -1
    assert.equal(stand[0], bed[0] + towardsAisle * (EDGE + D.standBackCm))
    assert.equal(stand[2], bed[2] + WARD_LAYOUT.wrist[2])
    const to = [stand[0] - at[0], stand[2] - at[2]]
    const length = Math.hypot(to[0], to[1])
    assert.ok(Math.abs(Math.sin(yaw) - to[0] / length) < 1e-9 && Math.abs(Math.cos(yaw) - to[1] / length) < 1e-9)
  }
})

test("marker bubbles float 40 to 50 cm above the patient", () => {
  const pillowTop = 20
  const above = WARD_LAYOUT.bedPinTip[1] - pillowTop
  assert.ok(above >= 40 && above <= 50, `Code Blue ${above}`)
  // Owner round 7 Nov: the scan pointer sits just over the hand, 10-20 cm above the wrist anchor.
  assert.ok(WARD_LAYOUT.scanTip[1] >= 10 && WARD_LAYOUT.scanTip[1] <= 20, `scan ${WARD_LAYOUT.scanTip[1]}`)
})

test("every panel stays outside the bed footprint, which starts at x = 149 on both rows", () => {
  for (const bed of BEDS) assert.ok(Math.abs(dashboardPose(bed).position[0]) + D.panelHalfWidthCm < 149)
})
