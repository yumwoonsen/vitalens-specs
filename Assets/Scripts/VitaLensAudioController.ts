// VitaLens audio cues (plan Task 7; design §3.6). Four generated SFX, no music.
// Main decides when a cue plays; this controller only plays it. The emergency tone
// is deliberately soft and unlike a hospital alarm or monitor beep. The glasses never speak.
//
// Room sounds are different: they come from real things in the ward (Bed 3's monitor, the
// Bed 2 patient), not from the glasses. They exist only to make the preview demo legible and
// are shipped WAVs from tools/generate_demo_audio.py, assigned to the two room inputs below
// (requireAsset by path does not find them in the preview). An empty input just means no sound.

/**
 * Demo-only room sounds. On glasses the real alarm and the real patient are in the room, so they
 * play only in the Lens Studio preview, like the ward model (showWardInLens). Set false to hear
 * only the glasses' own chimes in the preview as well.
 */
export const DEMO_ENVIRONMENT_AUDIO = true

export type RoomSound = "monitorAlarm" | "patientSpeech" | "nurseCheck" | "nurseAssess"
/** The nurse is the wearer, so her lines play plain at the camera. The patient and the monitor are in the room. */
const NURSE_SOUNDS: readonly RoomSound[] = ["nurseCheck", "nurseAssess"]
// Spatial falloff in cm: full volume within 1 m, silent beyond 20 m (the ward is about 6 m across).
const ROOM_MIN_CM = 100
const ROOM_MAX_CM = 2000

interface RoomEmitter {
  readonly so: SceneObject
  readonly audio: AudioComponent
  readonly timer: DelayedCallbackEvent
  pending: boolean
}

@component
export class VitaLensAudioController extends BaseScriptComponent {
  @input
  @hint("Identity verified, note approved, filed, handover approved")
  confirmTrack!: AudioTrackAsset

  @input
  @hint("Wristband mismatch or Doesn't match")
  mismatchTrack!: AudioTrackAsset

  @input
  @hint("Start and stop of sample capture")
  recordTrack!: AudioTrackAsset

  @input
  @hint("Opening the emergency view")
  emergencyTrack!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Demo only, preview only: Bed 3's monitor alarm during Code Blue (VitaLensMonitorAlarm)")
  monitorAlarmTrack!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Demo only, preview only: Mr Hakim's line while REC is on at Bed 2 (VitaLensPatientHakim)")
  patientSpeechTrack!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Demo only, preview only: the nurse's first line at Bed 2, 'Checking the dressing' (VitaLensNurseCheck)")
  nurseCheckTrack!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Demo only, preview only: the nurse's last line at Bed 2, 'Dressing dry and intact' (VitaLensNurseAssess)")
  nurseAssessTrack!: AudioTrackAsset

  @input
  @hint("Cue volume (0–1)")
  @widget(new SliderWidget(0, 1, 0.05))
  volume: number = 0.7

  private players = new Map<AudioTrackAsset, AudioComponent>()
  private room = new Map<RoomSound, RoomEmitter>()

  onAwake(): void {
    for (const track of [this.confirmTrack, this.mismatchTrack, this.recordTrack, this.emergencyTrack]) {
      if (!track) continue
      const a = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
      a.audioTrack = track
      a.volume = this.volume
      this.players.set(track, a)
    }
  }

  playConfirm(): void {
    this.play(this.confirmTrack)
  }
  playMismatch(): void {
    this.play(this.mismatchTrack)
  }
  playRecord(): void {
    this.play(this.recordTrack)
  }
  playEmergency(): void {
    this.play(this.emergencyTrack)
  }

  /**
   * Main calls this once. Loads the room sounds only where they may play (the preview, with
   * DEMO_ENVIRONMENT_AUDIO on). With a listener on the camera they are spatial; without one, plain.
   */
  setUpRoomAudio(camera: SceneObject | null): void {
    if (!DEMO_ENVIRONMENT_AUDIO || !global.deviceInfoSystem.isEditor() || this.room.size > 0) return
    const spatial = !!camera && this.ensureListener(camera)
    const tracks: [RoomSound, AudioTrackAsset][] = [
      ["monitorAlarm", this.monitorAlarmTrack], ["patientSpeech", this.patientSpeechTrack],
      ["nurseCheck", this.nurseCheckTrack], ["nurseAssess", this.nurseAssessTrack],
    ]
    for (const [kind, track] of tracks) {
      if (!track) continue
      const so = global.scene.createSceneObject("RoomSound " + kind)
      so.setParent(this.sceneObject)
      const audio = so.createComponent("Component.AudioComponent") as AudioComponent
      audio.audioTrack = track
      audio.volume = this.volume
      if (spatial && NURSE_SOUNDS.indexOf(kind) < 0) {
        const sp = audio.spatialAudio
        sp.enabled = true
        sp.positionEffect.enabled = true
        sp.distanceEffect.enabled = true
        sp.distanceEffect.type = Audio.DistanceCurveType.Logarithm
        sp.distanceEffect.minDistance = ROOM_MIN_CM
        sp.distanceEffect.maxDistance = ROOM_MAX_CM
      }
      const emitter: RoomEmitter = {so, audio, timer: this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent, pending: false}
      emitter.timer.bind(() => {
        if (!emitter.pending) return
        emitter.pending = false
        audio.play(1)
      })
      this.room.set(kind, emitter)
    }
  }

  /**
   * Plays a room sound once at a world position after an optional delay. A sound already waiting
   * or playing is left alone, so nothing stacks. Volume 0 is the mute setting. Returns whether
   * the sound will play.
   */
  playRoomSound(kind: RoomSound, at: vec3, delaySeconds: number = 0): boolean {
    const e = this.room.get(kind)
    if (!e || this.volume <= 0) return false
    if (e.pending || e.audio.isPlaying()) return true
    e.so.getTransform().setWorldPosition(at)
    e.pending = true
    e.timer.reset(delaySeconds)
    return true
  }

  /** Length in seconds of a room sound's clip, or null if it was not loaded (not the preview, or no clip assigned). */
  roomSoundSeconds(kind: RoomSound): number | null {
    const e = this.room.get(kind)
    return e && e.audio.duration > 0 ? e.audio.duration : null
  }

  /** Drops a waiting room sound and stops one in progress. */
  stopRoomSound(kind: RoomSound): void {
    const e = this.room.get(kind)
    if (!e) return
    e.pending = false
    if (e.audio.isPlaying()) e.audio.stop(false)
  }

  private ensureListener(camera: SceneObject): boolean {
    try {
      if (!camera.getComponent("Component.AudioListenerComponent")) camera.createComponent("Component.AudioListenerComponent")
      return true
    } catch (e) {
      return false
    }
  }

  private play(track: AudioTrackAsset): void {
    const a = track ? this.players.get(track) : undefined
    if (!a) return
    if (a.isPlaying()) a.stop(false)
    a.play(1)
  }
}
