// Live captions for the simulated sample conversation (Bed 2 and the target patient), shown while
// REC is on. Pure: the lens feeds it the elapsed seconds since REC began and the length of each
// spoken clip, and gets back what to display. Nothing here plays sound or touches the scene.
// The words are the fixture transcript (transcriptFor); this module only times them.

/** Seconds after REC begins before the first line is spoken. */
export const CAPTION_LEAD_S = 1.0
/** Pause between one spoken line and the next. */
export const CAPTION_GAP_S = 0.5
/** Reading pace for a line that has no audio clip. */
export const FALLBACK_WORDS_PER_S = 3
/** The previous line is one line on screen (about 44 characters fit at 1.4 cm): it is cut from the front to fit. */
export const PREVIOUS_LINE_MAX_CHARS = 42

export interface CaptionLine {
  readonly speaker: string
  readonly text: string
}

export interface CaptionSegment extends CaptionLine {
  readonly words: readonly string[]
  /** Seconds after REC begins when this line is spoken. */
  readonly start: number
  readonly duration: number
  /** True when the duration came from a real clip rather than the reading pace. */
  readonly hasAudio: boolean
}

export interface CaptionFrame {
  /** The line before the current one, cut to a single line, or null for the first line. */
  readonly previous: string | null
  readonly speaker: string
  /** The words of the current line spoken so far. */
  readonly text: string
  /** Changes exactly when the display must change: a new line or one more word. */
  readonly key: string
}

/** "Nurse: Checking the dressing." becomes {speaker: "Nurse", text: "Checking the dressing."}. */
export function parseTranscriptLine(line: string): CaptionLine {
  const i = line.indexOf(": ")
  return i > 0 && i <= 12 ? {speaker: line.slice(0, i), text: line.slice(i + 2)} : {speaker: "", text: line}
}

/**
 * Times each line. clipSeconds[i] is the real length of line i's audio, or null / missing when there
 * is none, in which case the line runs at FALLBACK_WORDS_PER_S.
 */
export function buildCaptionSegments(lines: readonly string[], clipSeconds: readonly (number | null | undefined)[] = []): CaptionSegment[] {
  const out: CaptionSegment[] = []
  let start = CAPTION_LEAD_S
  lines.forEach((raw, i) => {
    const {speaker, text} = parseTranscriptLine(raw)
    const words = text.split(/\s+/).filter((w) => w.length > 0)
    const clip = clipSeconds[i]
    const hasAudio = typeof clip === "number" && clip > 0
    const duration = hasAudio ? (clip as number) : Math.max(1, words.length / FALLBACK_WORDS_PER_S)
    out.push({speaker, text, words, start, duration, hasAudio})
    start += duration + CAPTION_GAP_S
  })
  return out
}

/** When the last line has finished. */
export function captionsEnd(segments: readonly CaptionSegment[]): number {
  const last = segments[segments.length - 1]
  return last ? last.start + last.duration : 0
}

/**
 * Words spoken by time t into a line. A word appears when its first letter is spoken, with the
 * line's duration shared out by characters, so a long word takes longer than a short one.
 */
export function wordsShown(segment: CaptionSegment, t: number): number {
  if (t < segment.start) return 0
  if (t >= segment.start + segment.duration) return segment.words.length
  const total = segment.words.reduce((n, w) => n + w.length + 1, 0)
  const elapsed = (t - segment.start) / segment.duration
  let before = 0
  let shown = 0
  for (const w of segment.words) {
    if (before / total <= elapsed) shown++
    before += w.length + 1
  }
  return shown
}

/** The last words of a line that fit on one screen line, with a leading ellipsis if cut. */
export function previousLineText(speaker: string, text: string, maxChars: number = PREVIOUS_LINE_MAX_CHARS): string {
  const prefix = speaker ? speaker + ": " : ""
  if (prefix.length + text.length <= maxChars) return prefix + text
  const room = maxChars - prefix.length - 1
  const words = text.split(/\s+/)
  let tail = ""
  for (let i = words.length - 1; i >= 0; i--) {
    const next = tail ? words[i] + " " + tail : words[i]
    if (next.length > room) break
    tail = next
  }
  return prefix + "\u2026" + (tail || text.slice(-room))
}

/**
 * What to display t seconds after REC began. Before the first line: null. Between lines and after
 * the last one, the finished line stays up until the next begins or the session is cleared.
 */
export function captionFrameAt(segments: readonly CaptionSegment[], t: number): CaptionFrame | null {
  let index = -1
  for (let i = 0; i < segments.length; i++) if (t >= segments[i].start) index = i
  if (index < 0) return null
  const segment = segments[index]
  const shown = wordsShown(segment, t)
  const before = index > 0 ? segments[index - 1] : null
  return {
    previous: before ? previousLineText(before.speaker, before.text) : null,
    speaker: segment.speaker,
    text: segment.words.slice(0, shown).join(" "),
    key: index + ":" + shown,
  }
}

/** Indices of lines whose start falls in (from, to]: the lines to begin speaking in this step. */
export function segmentsStartingIn(segments: readonly CaptionSegment[], from: number, to: number): number[] {
  const out: number[] = []
  segments.forEach((s, i) => {
    if (s.start > from && s.start <= to) out.push(i)
  })
  return out
}
