import {test} from "node:test"
import assert from "node:assert/strict"
import {WARD_LAYOUT, wristOffset} from "../../Assets/Scripts/Core/WardLayout"

test("Bed 2's wristband is on Mr Hakim's right wrist, near the bed", () => {
  const [x, y, z] = wristOffset("bed2")
  // Head at -Z, so the patient's right is +X: the aisle side of the left-hand row.
  assert.ok(x > 0 && x < 55, "right side, inside the bed's half width")
  assert.ok(y > 0 && y < 40, "just above the mattress")
  // Within an arm's reach of the torso, not past the foot of the bed.
  assert.ok(z < 0 && z > -60, "by the upper body, not at the foot end")
})

test("the other beds keep the legacy wrist anchor until their models are rebuilt", () => {
  for (const bed of ["bed1", "bed3", "bed4", null]) assert.deepEqual(wristOffset(bed), WARD_LAYOUT.wrist)
})
