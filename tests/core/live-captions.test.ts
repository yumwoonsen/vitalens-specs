import {test} from "node:test"
import assert from "node:assert/strict"
import {
  buildCaptionSegments, CAPTION_GAP_S, CAPTION_LEAD_S, captionFrameAt, captionsEnd, parseTranscriptLine,
  previousLineText, PREVIOUS_LINE_MAX_CHARS, segmentsStartingIn, wordsShown,
} from "../../Assets/Scripts/Core/LiveCaptions"
import {hasSampleTranscript, transcriptFor} from "../../Assets/Scripts/Core/EncounterFixtures"

const BED2 = transcriptFor("pt-bed2")
const CLIPS = [2.4, 10.08, 5.92]

test("a transcript line splits into speaker and text", () => {
  assert.deepEqual(parseTranscriptLine("Nurse: Checking the dressing."), {speaker: "Nurse", text: "Checking the dressing."})
  assert.deepEqual(parseTranscriptLine("No speaker here"), {speaker: "", text: "No speaker here"})
})

test("lines follow the clip lengths with a lead and a gap", () => {
  const s = buildCaptionSegments(BED2, CLIPS)
  assert.equal(s.length, 3)
  assert.equal(s[0].start, CAPTION_LEAD_S)
  assert.ok(Math.abs(s[1].start - (CAPTION_LEAD_S + 2.4 + CAPTION_GAP_S)) < 1e-9)
  assert.ok(Math.abs(s[2].start - (s[1].start + 10.08 + CAPTION_GAP_S)) < 1e-9)
  assert.ok(s.every((x) => x.hasAudio))
  assert.ok(Math.abs(captionsEnd(s) - (s[2].start + 5.92)) < 1e-9)
})

test("a line without a clip runs at about three words a second", () => {
  const s = buildCaptionSegments(["Nurse: one two three four five six"], [])
  assert.equal(s[0].hasAudio, false)
  assert.equal(s[0].duration, 2)
  assert.equal(buildCaptionSegments(["Nurse: one two"], [null])[0].duration, 1)
})

test("every patient with a sample transcript gets captions, with or without audio", () => {
  for (const pid of ["pt-target", "pt-bed2"] as const) {
    assert.ok(hasSampleTranscript(pid))
    assert.ok(buildCaptionSegments(transcriptFor(pid), []).length >= 3)
  }
})

test("nothing shows before the first line, then words appear in order to the full line", () => {
  const s = buildCaptionSegments(BED2, CLIPS)
  assert.equal(captionFrameAt(s, 0), null)
  assert.equal(captionFrameAt(s, CAPTION_LEAD_S - 0.01), null)
  const words = s[1].words
  let last = 0
  for (let t = s[1].start; t <= s[1].start + s[1].duration + 0.2; t += 0.05) {
    const n = wordsShown(s[1], t)
    assert.ok(n >= last && n <= words.length)
    last = n
  }
  assert.equal(last, words.length)
  assert.equal(wordsShown(s[1], s[1].start), 1)
  const done = captionFrameAt(s, s[1].start + s[1].duration)!
  assert.equal(done.text, s[1].text)
  assert.equal(done.speaker, "Patient")
})

test("the current line and the one before it are shown", () => {
  const s = buildCaptionSegments(BED2, CLIPS)
  const first = captionFrameAt(s, 1.1)!
  assert.equal(first.speaker, "Nurse")
  assert.equal(first.previous, null)
  const patient = captionFrameAt(s, s[1].start + 0.1)!
  assert.ok(patient.previous!.startsWith("Nurse: \u2026"))
  assert.ok(patient.previous!.endsWith("on your right knee."))
  assert.ok(patient.previous!.length <= PREVIOUS_LINE_MAX_CHARS)
  const last = captionFrameAt(s, s[2].start + s[2].duration + 30)!
  assert.equal(last.speaker, "Nurse")
  assert.equal(last.text, s[2].text)
  assert.ok(last.previous!.length <= PREVIOUS_LINE_MAX_CHARS)
  assert.ok(last.previous!.startsWith("Patient: …"))
})

test("a line stays up in the gap and the key changes only when the display does", () => {
  const s = buildCaptionSegments(BED2, CLIPS)
  const endOfFirst = s[0].start + s[0].duration
  const a = captionFrameAt(s, endOfFirst)!
  const b = captionFrameAt(s, endOfFirst + CAPTION_GAP_S * 0.9)!
  assert.equal(a.key, b.key)
  assert.equal(b.text, s[0].text)
  const keys = new Set<string>()
  let changes = 0
  let prev = ""
  for (let t = 0; t < captionsEnd(s) + 1; t += 1 / 60) {
    const f = captionFrameAt(s, t)
    const k = f ? f.key : "none"
    if (k !== prev) changes++
    prev = k
    keys.add(k)
  }
  const totalWords = s.reduce((n, x) => n + x.words.length, 0)
  assert.equal(changes, keys.size)
  assert.ok(changes <= totalWords + 1, "at most one update per word")
})

test("each line starts speaking exactly once as time advances", () => {
  const s = buildCaptionSegments(BED2, CLIPS)
  const started: number[] = []
  let t0 = -1
  for (let t = 0; t < 40; t += 1 / 30) {
    started.push(...segmentsStartingIn(s, t0, t))
    t0 = t
  }
  assert.deepEqual(started, [0, 1, 2])
})

test("the previous line is cut to one screen line from the front", () => {
  assert.equal(previousLineText("Nurse", "Short."), "Nurse: Short.")
  const long = previousLineText("Patient", BED2[1].replace("Patient: ", ""))
  assert.ok(long.length <= PREVIOUS_LINE_MAX_CHARS)
  assert.ok(long.endsWith("maybe three out of ten."))
})
