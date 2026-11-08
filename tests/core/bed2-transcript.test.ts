import {test} from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {transcriptFor} from "../../Assets/Scripts/Core/EncounterFixtures"

// demo/ward/bed2-transcript.json is the one source for the Bed 2 conversation. The audio generator
// reads it too, so the spoken clips and the fixture cannot drift apart.
const source = JSON.parse(readFileSync(new URL("../../demo/ward/bed2-transcript.json", import.meta.url), "utf8")) as {
  lines: {speaker: string, text: string}[]
}

test("Bed 2 fixture transcript equals demo/ward/bed2-transcript.json", () => {
  assert.deepEqual(transcriptFor("pt-bed2"), source.lines.map((l) => `${l.speaker}: ${l.text}`))
})

test("Bed 2 transcript keeps the facts the draft relies on", () => {
  const text = source.lines.map((l) => l.text).join(" ").toLowerCase()
  assert.equal(source.lines.length, 3)
  assert.deepEqual(source.lines.map((l) => l.speaker), ["Nurse", "Patient", "Nurse"])
  for (const phrase of ["right knee", "when i move", "three out of ten", "pain 3 out of 10"]) assert.ok(text.includes(phrase), phrase)
})
