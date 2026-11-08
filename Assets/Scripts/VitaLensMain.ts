// VitalLens main script (plan Tasks 7–9). Owns the one encounter store: the state lives
// here and changes only through reduce() from Assets/Scripts/Core. UI modules are
// passive views: Main subscribes to their intent events, dispatches the matching
// encounter event, then pushes selector output back to every view. Timers and
// navigation never save, verify or change a draft; a refused event changes nothing.
// The glasses never sign or file (owner round 2).
// Inputs: every UI module, the audio controller. Must not author UI or text.
import {createInitialState, reduce} from "./Core/EncounterReducer"
import * as Sel from "./Core/EncounterSelectors"
import {selectCards} from "./Core/CardPresentation"
import {hasSampleTranscript, LABELS, transcriptFor} from "./Core/EncounterFixtures"
import {buildCaptionSegments, CaptionSegment, captionFrameAt, segmentsStartingIn} from "./Core/LiveCaptions"
import type {BedId, EncounterEvent, EncounterState} from "./Core/EncounterTypes"
import {DEMO_ENVIRONMENT_AUDIO, RoomSound, VitaLensAudioController} from "./VitaLensAudioController"
import {VitaLensBedFlagUI} from "./VitaLensBedFlagUI"
import {applyPatientLook} from "./VitaLensPatientLooks"
import {BootView, VitaLensBootUI} from "./VitaLensBootUI"
import {VitaLensBriefUI} from "./VitaLensBriefUI"
import {DockAction, VitaLensDockUI} from "./VitaLensDockUI"
import {VitaLensEmergencyUI} from "./VitaLensEmergencyUI"
import {VitaLensEmergencyDestination} from "./VitaLensEmergencyDestination"
import {VitaLensHandoverUI} from "./VitaLensHandoverUI"
import {VitaLensIdentityUI} from "./VitaLensIdentityUI"
import {VitaLensMiniHudUI} from "./VitaLensMiniHudUI"
import {buildDemoWard,demoBedAnchor,SHOW_DEMO_WARD} from "./VitaLensDemoWard"
import {CODE_BLUE_MARKER,SCAN_MARKER,selectBedMarker,selectEmergencyScreen} from "./VitaLensEmergencyScreen"
import {selectPatientScreen} from "./VitaLensPatientScreen"
import {VitaLensRailUI} from "./VitaLensRailUI"
import {VitaLensReviewUI} from "./VitaLensReviewUI"
import {VitaLensRingUI} from "./VitaLensRingUI"
import {VitaLensRoundUI} from "./VitaLensRoundUI"
import {ScreenView, VitaLensScreenUI, WristStage} from "./VitaLensScreenUI"
import {VitaLensWristUI} from "./VitaLensWristUI"

import {WARD_LAYOUT,dashboardPose,followAlpha,hudOffset,proximityEvent,wristOffset} from "./Core/WardLayout"
import {advanceWardDrill, createWardInteraction, observeWardEvent} from "./Core/WardInteraction"

const BED_INDEX: {readonly [K in BedId]: number} = {bed1: 0, bed2: 1, bed3: 2, bed4: 3}

/** Where the older cards and the menu sit, inside the view frame at the start pose. */
const FRAME_CARD = new vec3(0, 1, -110)
const FRAME_MENU = new vec3(0, -3, -110)
/**
 * kiro/proposal minimises the board when the camera is over 170 cm from the bed. Off while
 * the screens stay in the view frame: from the start pose it would hide them.
 */
const ROUTINE_PROXIMITY = false
/** The scripted drill 5 s after the first Bed 2 draft. Off: Code Blue starts from the presenter control or Next. */
const WARD_DRILL_AUTOSTART = false
/**
 * Demo-only room sounds, offset in cm from the bed centre (WardLayout: the head end is -Z, the
 * pillow top at y = 20). Approximate: Bed 3's monitor on the head wall, Mr Hakim's head on the pillow.
 */
const MONITOR_FROM_BED = new vec3(45, 70, -105)
const PATIENT_HEAD_FROM_BED = new vec3(0, 25, -72)
/** Bed 2's sample transcript is spoken line by line: the nurse, Mr Hakim, the nurse. Other patients' captions run without audio. */
const BED2_SPEECH: readonly RoomSound[] = ["nurseCheck", "patientSpeech", "nurseAssess"]

/** Storyboard view 1: the Shift overview is the first view, so Boot and Clock in pass through Core's own events. */
function firstViewState(): EncounterState {
  return reduce(reduce(createInitialState(), {type: "START_DEMO"}), {type: "CLOCK_IN"})
}

@component
export class VitaLensMain extends BaseScriptComponent {
  @input
  @hint("Menu and privacy plate on the bed card")
  rail!: VitaLensRailUI

  @input
  @hint("Dock: Back, Privacy, Minimise, Emergency, Next")
  dock!: VitaLensDockUI

  @input
  @hint("Small core ring (optional; round 2b removes it from the scene)")
  @allowUndefined
  ring!: VitaLensRingUI

  @input
  @hint("Boot and Clock-in windows")
  boot!: VitaLensBootUI

  @input
  @hint("Shift brief and ward counts")
  brief!: VitaLensBriefUI

  @input
  @hint("Identity gate and demo options")
  identity!: VitaLensIdentityUI

  @input
  @hint("Wristband bracket and identity chip")
  wrist!: VitaLensWristUI

  @input
  @hint("Routine round: record lines, consent and capture, sample transcript")
  round!: VitaLensRoundUI

  @input
  @hint("Draft review: draft, pick list, reject, Save for COW review")
  review!: VitaLensReviewUI

  @input
  @hint("Emergency: single-scan gate, fixed record lines, playback vitals")
  emergency!: VitaLensEmergencyUI

  @input
  @hint("Handover: ISBAR with sources, tasks with owners, separate approval slider")
  handover!: VitaLensHandoverUI

  @input
  @hint("Bed 1 flag")
  flag1!: VitaLensBedFlagUI

  @input
  @hint("Bed 2 flag")
  flag2!: VitaLensBedFlagUI

  @input
  @hint("Bed 3 flag")
  flag3!: VitaLensBedFlagUI

  @input
  @hint("Bed 4 flag")
  flag4!: VitaLensBedFlagUI

  @input
  @hint("Head-locked status strip with Menu and Expand")
  miniHud!: VitaLensMiniHudUI

  @input
  @hint("Audio cues")
  audio!: VitaLensAudioController

  @input
  @hint("Print refused events to the log (debug)")
  logRefused: boolean = false

  @input @allowUndefined bed1Anchor!: SceneObject
  @input @allowUndefined bed2Anchor!: SceneObject
  @input @allowUndefined bed3Anchor!: SceneObject
  @input @allowUndefined bed4Anchor!: SceneObject
  @input @allowUndefined @hint("Patient hair, Meshes/Hair of VitalLensPatientBody.glb (preview ward only)") patientHairMesh!: RenderMesh
  @input @allowUndefined @hint("Patient hair bun, Meshes/Hair bun of VitalLensPatientBody.glb") patientBunMesh!: RenderMesh
  @input bedsideEnterCm: number = 140
  @input bedsideExitCm: number = 170
  @input
  @allowUndefined
  @hint("The imported ward model")
  wardRoot!: SceneObject
  @input
  @hint("Draw the ward as Lens content in the Lens Studio preview, for a bright ward and dark plates inside the frame. Never drawn on glasses")
  showWardInLens: boolean = true
  private originalRoundPosition: vec3 | null = null
  private originalRoundRotation: quat | null = null
  private routineNear=true
  private proximityBed=""
  private mirrorBoard=false
  private state: EncounterState = firstViewState()
  private started = false
  private rerender = false
  /** View-only drill clock (owner round 2, D1). Never written to the store. */
  private drillSeconds = 0
  private drillShown = -1
  private drillDestination: VitaLensEmergencyDestination | null = null
  private wardDrill = createWardInteraction()
  /** View-only: "Call doctor (simulated)" was pressed in this emergency view. Places no call. */
  private callDoctorPressed = false
  private screen!: VitaLensScreenUI
  private lastScreen: ScreenView | null = null
  /**
   * View-only: Core moves to the round on the second confirmation, but the storyboard
   * shows the verified wristband screen first (s1-wb-verified). This holds that screen
   * until Next. It is never written to the store and no timer ends it.
   */
  private verifiedHold = false
  /** The reopen offer was closed with Overview; a fresh verification or Continue note offers it again. */
  private reopenDismissed = false
  /** View-only: the shift screen reads as the ward overview right after a drill (s3-after). */
  private afterDrill = false
  /** View-only: the live captions while REC is on (preview demo). One clock drives both the audio and the words. */
  private captions: {kinds: readonly RoomSound[]; segments: CaptionSegment[]; t: number; from: number; key: string} | null = null

  /** Read-only view of the store, for LEAF scenarios and debugging. */
  getState(): EncounterState {
    return this.state
  }

  /** The drill second the emergency view last rendered, for LEAF scenarios. */
  getDrillSecondShown(): number {
    return this.drillShown
  }

  onAwake(): void {
    if (SHOW_DEMO_WARD) this.createEvent("OnStartEvent").bind(() => buildDemoWard(this.sceneObject, this.wrist.material))
    this.createEvent("OnStartEvent").bind(() => this.wire())
    // First render after every component has started, so views apply visibility
    // only once their UI Kit parts exist (specs-build-ui G3).
    const first = this.createEvent("UpdateEvent")
    first.bind(() => {
      if (this.started) return
      this.started = true
      first.enabled = false
      this.render()
    })
    // Render once more on the frame after a change: windows shown in the change
    // re-enable their UI Kit controls on OnEnableEvent, and this re-applies the
    // locked/unlocked state from the same store (no state change).
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.rerender) return
      this.rerender = false
      this.render()
    })
    this.createEvent("UpdateEvent").bind(()=>this.updateSpatial())
    this.createEvent("UpdateEvent").bind(() => this.stepCaptions())
    if (WARD_DRILL_AUTOSTART) this.createEvent("UpdateEvent").bind(() => {
      if (!this.started || this.wardDrill.drill === "consumed") return
      const stage = this.lastScreen?.kind === "patient" ? this.lastScreen.patient?.stage : null
      const draftVisible = stage === "draft" || stage === "corrected"
      const drill = advanceWardDrill(this.wardDrill, this.state, draftVisible, getDeltaTime())
      this.wardDrill = drill.state
      if (drill.open) this.dispatch({type: "OPEN_EMERGENCY"})
    })
    // The drill clock advances only the emergency view, once per whole second.
    this.createEvent("UpdateEvent").bind(() => {
      if (!this.started || this.state.phase !== "emergency") return
      this.drillSeconds += getDeltaTime()
      if (Math.floor(this.drillSeconds) !== this.drillShown) this.renderEmergency()
    })
  }

  private wireScreen(): void {
    // Created here rather than in the scene: nothing in Scene.scene changes for it.
    const host = global.scene.createSceneObject("Screen Panel")
    host.setParent(this.miniHud.consoleRoot)
    this.screen = host.createComponent(VitaLensScreenUI.getTypeName()) as VitaLensScreenUI
    this.screen.setCamera(this.miniHud.cameraObject)
    this.screen.onSelectBed.add((bedId) => this.dispatch({type: "SELECT_BED", bedId}))
    this.screen.onScan.add(() => this.dispatch({type: "SCAN_WRISTBAND", wristband: "assigned"}))
    this.screen.onConfirm.add((identifier) => this.dispatch({type: "CONFIRM_IDENTIFIER", identifier}))
    this.screen.onRescan.add(() => this.dispatch({type: "RESCAN"}))
    this.screen.onIntent.add((e) => {
      if (e.type === "OPEN_NOTE") {
        this.openNote()
        return
      }
      // Core has no event for closing the reopen offer: the archive stays and the view moves on.
      if (e.type === "OPEN_OVERVIEW" && this.lastScreen?.patient?.stage === "reopen") this.reopenDismissed = true
      this.dispatch(e)
      // As in the storyboard, Reject goes straight back to the note-ready screen.
      if (e.type === "REJECT_DRAFT") this.dispatch({type: "NEW_CAPTURE"})
    })
    this.screen.onMenu.add(() => this.dispatch({type: "TOGGLE_MENU"}))
    this.rail.onClose.add(() => this.dispatch({type: "TOGGLE_MENU"}))
    this.screen.onDock.add((a) => this.screenDock(a))
  }

  /** Archived text is offered again rather than left behind a fresh capture, which would block reopening it. */
  private openNote(): void {
    const s = this.state
    if (s.scannedPatientId !== null && s.interruptedWork[s.scannedPatientId] && !s.note) {
      this.reopenDismissed = false
      this.render()
      this.rerender = true
      return
    }
    this.dispatch({type: "OPEN_NOTE"})
  }

  private screenDock(a: DockAction): void {
    const s = this.state
    // The docked row presses the same buttons: the screens are hidden while minimised, but they still decide what Back and Next do.
    const sv = s.view.minimised ? {...s, view: {...s.view, minimised: false}} : s
    if (a === "next" && this.verifiedHold) {
      // Core is already on the round: Next only releases the view.
      this.verifiedHold = false
      this.render()
      this.rerender = true
      return
    }
    // BACK_TO_BRIEF clears the bed choice and any scan; NAV_BACK alone would leave them set.
    if (a === "back" && s.phase === "identify" && s.verification !== "verified") {
      this.dispatch({type: "BACK_TO_BRIEF"})
      return
    }
    // COW / EHR was opened from the saved note, so Back returns there.
    if (a === "back" && selectPatientScreen(sv) !== null && s.bodyView === "cow") {
      this.dispatch({type: "OPEN_NOTE"})
      return
    }
    // Within the patient screens Back returns to the overview; NAV_BACK would leave the note for the wristband check.
    if (a === "back" && selectPatientScreen(sv) !== null && s.bodyView !== "overview") {
      this.dispatch({type: "OPEN_OVERVIEW"})
      return
    }
    // The spec enables Next on the overview and care details: it goes to the note.
    if (a === "next" && selectPatientScreen(sv) !== null && (s.bodyView === "overview" || s.bodyView === "care")) {
      this.openNote()
      return
    }
    this.dispatch(this.dockEvent(a))
  }

  /** Which wristband screen shows, or null. Name then date of birth, as in the storyboard. */
  private wristStage(s: EncounterState): WristStage | null {
    if (s.privacy || s.bedId === null) return null
    if (s.phase !== "identify" && !this.verifiedHold) return null
    if (s.verification === "mismatch") return "mismatch"
    if (s.verification === "verified") return "verified"
    if (s.verification === "idle") return "scan"
    return s.confirmed.name ? "dob" : "name"
  }

  private wire(): void {
    // On glasses the real room is there, so the model must never draw over it.
    const showWard=this.showWardInLens && global.deviceInfoSystem.isEditor()
    if(this.wardRoot)this.wardRoot.enabled=showWard
    // Each bed anchor carries its patient body, which belongs to the ward: same flag.
    for(const bed of [this.bed1Anchor,this.bed2Anchor,this.bed3Anchor,this.bed4Anchor]){
      if(!bed)continue
      for(let i=0;i<bed.getChildrenCount();i++){const child=bed.getChild(i);if(child.name==="Patient Body")child.enabled=showWard}
    }
    // Each body gets its patient's skin, gown and hair; the shapes are shared (VitaLensPatientLooks).
    if(showWard)[this.bed1Anchor,this.bed2Anchor,this.bed3Anchor,this.bed4Anchor].forEach((bed,i)=>{if(bed)applyPatientLook(bed,i,this.patientHairMesh ?? null,this.patientBunMesh ?? null)})
    if(SHOW_DEMO_WARD&&this.bed2Anchor)this.bed2Anchor.getTransform().setWorldPosition(demoBedAnchor())
    if(SHOW_DEMO_WARD)for(const f of [this.flag1,this.flag3,this.flag4])if(f)f.sceneObject.enabled=false
    // Each flag floats over its own bed's head end, from the bed's authored position (WARD_LAYOUT.flag).
    const flagBeds:[VitaLensBedFlagUI,SceneObject][]=[[this.flag1,this.bed1Anchor],[this.flag2,this.bed2Anchor],[this.flag3,this.bed3Anchor],[this.flag4,this.bed4Anchor]]
    for(const [f,bed] of flagBeds)if(f&&bed)f.sceneObject.getTransform().setWorldPosition(bed.getTransform().getWorldPosition().add(new vec3(...WARD_LAYOUT.flag.offset)))
    // Room sounds belong to the real ward too: the controller loads them only in the preview.
    this.audio?.setUpRoomAudio(this.miniHud ? this.miniHud.cameraObject : null)
    this.wireScreen()
    this.boot.onBegin.add(() => this.dispatch({type: "START_DEMO"}))
    this.boot.onClockIn.add(() => this.dispatch({type: "CLOCK_IN"}))
    this.brief.onSelectBed.add((bedId) => this.dispatch({type: "SELECT_BED", bedId}))
    this.identity.onScan.add((wristband) => this.dispatch({type: "SCAN_WRISTBAND", wristband}))
    this.identity.onConfirm.add((identifier) => this.dispatch({type: "CONFIRM_IDENTIFIER", identifier}))
    this.identity.onDoesntMatch.add(() => this.dispatch({type: "MARK_MISMATCH"}))
    this.identity.onRescan.add(() => this.dispatch({type: "RESCAN"}))
    this.identity.onBackToBrief.add(() => this.dispatch({type: "BACK_TO_BRIEF"}))
    this.miniHud.onMenu.add(() => this.dispatch({type: "TOGGLE_MENU"}))
    this.rail.onSwitch.add(() => this.dispatch({type: "REQUEST_SWITCH"}))
    this.rail.onReset.add(() => this.dispatch({type: "REQUEST_RESET"}))
    this.rail.onConfirm.add(() => this.dispatch({type: "CONFIRM_PENDING"}))
    this.rail.onCancel.add(() => this.dispatch({type: "CANCEL_PENDING"}))
    this.round.onIntent.add(e=>this.dispatch(e))
    this.miniHud.onIntent.add(e=>this.dispatch(e))
    this.miniHud.onMotion.add(value=>{this.round.reducedMotion=value})
    this.miniHud.onMirror.add(value=>{this.mirrorBoard=value})
    this.review.onOpenFlag.add((flagId) => this.dispatch({type: "OPEN_FLAG", flagId}))
    this.review.onChoose.add((c) => this.dispatch({type: "CORRECT_DRAFT", flagId: c.flagId, optionId: c.optionId}))
    this.review.onCloseFlag.add(() => this.dispatch({type: "CLOSE_FLAG"}))
    this.review.onReject.add(() => this.dispatch({type: "REJECT_DRAFT"}))
    this.review.onNewCapture.add(() => this.dispatch({type: "NEW_CAPTURE"}))
    this.review.onAmend.add(() => this.dispatch({type: "AMEND_NOTE"}))
    this.review.onSave.add(() => this.dispatch({type: "SAVE_FOR_REVIEW"}))
    this.emergency.onScan.add(() => this.dispatch({type: "EMERGENCY_SCAN"}))
    this.emergency.onCallDoctor.add(() => {
      this.callDoctorPressed = true
      this.renderEmergency()
    })
    this.handover.onBuild.add(() => this.dispatch({type: "BUILD_HANDOVER"}))
    this.handover.onApprove.add(() => this.dispatch({type: "APPROVE_HANDOVER"}))
    this.dock.onAction.add((a) => this.dispatch(this.dockEvent(a)))
    this.miniHud.onExpand.add(() => this.dispatch({type: "RESTORE"}))
    this.miniHud.onDock.add((a) => this.screenDock(a))
  }

  private dockEvent(a: DockAction): EncounterEvent {
    const s = this.state
    switch (a) {
      case "back":
        return {type: "NAV_BACK"}
      case "next":
        return {type: "NAV_NEXT"}
      case "privacy":
        return s.privacy ? {type: "PRIVACY_OFF"} : {type: "PRIVACY_ON"}
      case "minimise":
        // Minimise collapses the dashboard into the strip under the top HUD; the same control restores it.
        return s.view.minimised ? {type: "RESTORE"} : {type: "MINIMISE"}
      default:
        return s.phase === "emergency" ? {type: "CLOSE_EMERGENCY"} : {type: "OPEN_EMERGENCY"}
    }
  }

  dispatch(event: EncounterEvent): void {
    const prev = this.state
    let next = reduce(prev, event)
    if (next === prev) {
      if (this.logRefused) print("[VitaLens] refused " + event.type)
      return
    }
    this.wardDrill = observeWardEvent(this.wardDrill, event, prev, next)
    // A reset returns to Core's Boot state; the view restarts on the Shift overview.
    if (next.phase === "boot") next = firstViewState()
    if (next.phase !== "clockIn") this.afterDrill = false
    else if (prev.phase === "emergency") this.afterDrill = true
    if (next.phase !== "round" || next.verification !== "verified") this.verifiedHold = false
    else if (prev.verification !== "verified" && prev.phase === "identify") this.verifiedHold = true
    if (next.verification !== "verified") this.reopenDismissed = false
    this.state = next
    if (next.phase !== "emergency" || next.privacy) this.drillDestination?.hide()
    if (next.phase === "emergency" && prev.phase !== "emergency") {
      this.drillSeconds = 0
      this.callDoctorPressed = false
    }
    this.cue(prev, next)
    this.captionCue(prev, next)
    this.render()
    this.rerender = true
  }

  /** Sound only on a real state change (design §3.6). */
  private cue(prev: EncounterState, next: EncounterState): void {
    if (!this.audio) return
    if (next.verification === "verified" && prev.verification !== "verified") this.audio.playConfirm()
    if (next.verification === "mismatch" && prev.verification !== "mismatch") this.audio.playMismatch()
    if ((next.capture === "recording") !== (prev.capture === "recording")) this.audio.playRecord()
    // In the preview Bed 3's own monitor alarms instead of the glasses' tone, which would clash with it.
    if (next.phase === "emergency" && prev.phase !== "emergency") {
      const alarm = !!this.bed3Anchor && this.audio.playRoomSound("monitorAlarm", this.bed3Anchor.getTransform().getWorldPosition().add(MONITOR_FROM_BED))
      if (!alarm) this.audio.playEmergency()
    }
    if (prev.phase === "emergency" && next.phase !== "emergency") this.audio.stopRoomSound("monitorAlarm")
    const approved = (s: EncounterState) => s.handover !== null && s.handover.status === "approved"
    if (approved(next) && !approved(prev)) this.audio.playConfirm()
  }

  /** Live captions run in the preview demo only, like the room sounds, for a patient with a sample transcript. */
  private captionsOn(pid: EncounterState["scannedPatientId"]): boolean {
    return DEMO_ENVIRONMENT_AUDIO && global.deviceInfoSystem.isEditor() && pid !== null && hasSampleTranscript(pid)
  }

  /** Starts the captions with REC and ends them with Stop, privacy, an emergency or anything else that ends REC. */
  private captionCue(prev: EncounterState, next: EncounterState): void {
    const on = (s: EncounterState) => s.capture === "recording" && !s.privacy && this.captionsOn(s.scannedPatientId)
    if (on(next) && !on(prev)) this.startCaptions(next.scannedPatientId)
    else if (!on(next) && on(prev)) this.endCaptions()
  }

  private startCaptions(pid: EncounterState["scannedPatientId"]): void {
    if (pid === null) return
    const kinds = pid === "pt-bed2" ? BED2_SPEECH : []
    const lines = transcriptFor(pid)
    // Real clip lengths where a clip is loaded; lines without one run at the reading pace.
    const clips = lines.map((_, i) => (kinds[i] && this.audio ? this.audio.roomSoundSeconds(kinds[i]) : null))
    this.captions = {kinds, segments: buildCaptionSegments(lines, clips), t: 0, from: -1, key: ""}
  }

  private endCaptions(): void {
    this.captions = null
    for (const kind of BED2_SPEECH) this.audio?.stopRoomSound(kind)
    this.screen?.setCaptions(null)
  }

  /** Each frame: start the lines whose time has come, and update the screen only when a word is added. */
  private stepCaptions(): void {
    const c = this.captions
    if (!c || !this.screen) return
    c.t += getDeltaTime()
    for (const i of segmentsStartingIn(c.segments, c.from, c.t)) this.speakLine(c.kinds[i])
    c.from = c.t
    const frame = captionFrameAt(c.segments, c.t)
    const key = frame ? frame.key : "none"
    if (key === c.key) return
    c.key = key
    this.screen.setCaptions(frame)
  }

  /** The nurse (the wearer) is heard at the camera; Mr Hakim from his head. */
  private speakLine(kind: RoomSound | undefined): void {
    if (!kind || !this.audio) return
    const at = kind === "patientSpeech"
      ? (this.bed2Anchor ? this.bed2Anchor.getTransform().getWorldPosition().add(PATIENT_HEAD_FROM_BED) : null)
      : (this.miniHud ? this.miniHud.cameraObject.getTransform().getWorldPosition() : null)
    if (at) this.audio.playRoomSound(kind, at)
  }

  private bootView(s: EncounterState): BootView {
    return {
      disclosureVisible: s.phase === "boot",
      clockInVisible: s.phase === "clockIn" && s.session === "none" && !s.privacy,
      begin: s.phase === "boot",
      clockIn: s.phase === "clockIn" && s.session === "none",
      demoSessionLabel: LABELS.demoSession,
    }
  }

  private render(): void {
    if (!this.started) return
    const s = this.state
    const ward = Sel.selectWardFlags(s)
    const identity = Sel.selectIdentity(s)
    const stage = this.wristStage(s)
    const held = this.verifiedHold && !s.privacy
    // While minimised the screens are hidden but their step, and the dock's enabled states, are still read from the same view.
    const sv = s.view.minimised ? {...s, view: {...s.view, minimised: false}} : s
    const patient = held ? null : selectPatientScreen(sv, this.reopenDismissed, this.captionsOn(s.scannedPatientId))
    const emergency = selectEmergencyScreen(s, this.drillShown)
    const screenKind = s.view.minimised ? null : ward.briefVisible ? ("shift" as const) : stage !== null && !s.view.minimised ? ("wristband" as const) : patient ? ("patient" as const) : emergency ? ("emergency" as const) : null
    const baseRail = Sel.selectStatusRail(s)
    // The held verified screen is still the Verify step in the strip (s1-wb-verified).
    // A patient screen names its own step: Core still says Overview during consent and capture.
    const modeOverride = held ? "Verify · " + baseRail.demoTime : patient ? patient.stripMode : this.afterDrill ? "Ward · " + baseRail.demoTime : null
    const rail = modeOverride ? {...baseRail, strip: {...baseRail.strip, mode: modeOverride}} : baseRail
    this.rail.render(rail)
    this.miniHud.setSpecStrip(screenKind !== null || (s.view.minimised && s.phase !== "emergency"))
    const dockView = Sel.selectDock(s)
    this.dock.render(dockView)
    this.lastScreen = {
      kind: screenKind,
      ward,
      identity,
      stage,
      patient,
      emergency,
      afterDrill: this.afterDrill,
      controls: {
        // Details stay hidden until Privacy off: Back would leave the patient screens for the old privacy card.
        back: patient?.stage !== "privacy" && dockView.back.enabled,
        privacy: dockView.privacy.enabled,
        minimise: dockView.minimise.enabled,
        emergency: dockView.emergency.enabled,
        // Core would let Next leave an unverified check; the storyboard disables it there.
        next: patient ? patient.next : stage === null ? dockView.next.enabled : stage === "verified",
        menu: true,
      },
    }
    // The docked row shows the same button states as the full dock would.
    const c = this.lastScreen.controls
    this.miniHud.setDockRow(s.view.minimised && s.phase !== "emergency"
      ? {back: c.back, privacy: c.privacy, minimise: c.minimise, emergency: c.emergency, next: c.next, privacyOn: s.privacy, rec: s.capture === "recording"}
      : null)
    this.miniHud.render(rail)
    const dashboard = this.dashboard()
    this.screen.setWardFrame(dashboard ? dashboard.at : null, dashboard ? dashboard.turn : quat.quatIdentity())
    this.screen.render(this.lastScreen)
    if (this.ring) this.ring.render(Sel.selectRing(s), s.bedId === null ? -1 : BED_INDEX[s.bedId])
    this.boot.render(this.bootView(s))
    this.brief.render(ward)
    this.identity.render(identity)
    this.wrist.render(identity, stage)
    const draft = Sel.selectDraft(s)
    this.review.render(draft)
    this.renderEmergency()
    this.handover.render(Sel.selectHandover(s))
    // New cards own the accepted nurse flow; retain boot/handover modules intact.
    // The one-panel screen replaces the old Brief and the card where it applies.
    for(const old of [this.identity,this.review,this.emergency,this.brief]) old.sceneObject.enabled=false
    this.rail.sceneObject.enabled=s.phase === "handover" || rail.menu.open
    if(rail.menu.open){const m=this.rail.sceneObject.getTransform();m.setWorldPosition(this.frameInWard(FRAME_MENU));m.setWorldRotation(this.dashboard()?.turn ?? quat.quatIdentity())}
    this.dock.sceneObject.enabled=s.phase === "handover"
    if(this.ring)this.ring.sceneObject.enabled=false
    // The screens draw their own emergency status; his corner HUD stays for privacy and the briefing.
    this.miniHud.sceneObject.enabled=!emergency && (s.phase !== "emergency" || s.emergencyNear || s.privacy)
    if(!emergency && s.phase === "emergency" && s.emergencyNear && !s.privacy)this.miniHud.renderEmergencyStatus(Sel.selectEmergency(s,this.drillShown).drillTimer,s.emergencyContact)
    this.round.render(selectCards(s,this.drillShown))
    // A screen replaces the card, whose buttons would duplicate its own.
    this.round.setCardShown(screenKind === null && !s.view.minimised)
    for (const f of [this.flag1, this.flag2, this.flag3, this.flag4]) if (f) f.render(ward)
  }

  private updateSpatial():void {
    if(!this.started || !this.miniHud.cameraObject)return
    let s=this.state
    const t=this.round.sceneObject.getTransform(),cam=this.miniHud.cameraObject.getTransform()
    if(!this.originalRoundPosition){this.originalRoundPosition=t.getLocalPosition();this.originalRoundRotation=t.getLocalRotation()}
    const anchor=s.phase === "emergency"?this.bed3Anchor:s.bedId === "bed1"?this.bed1Anchor:s.bedId === "bed2"?this.bed2Anchor:s.bedId === "bed3"?this.bed3Anchor:this.bed4Anchor
    if(anchor)this.wrist.sceneObject.getTransform().setWorldPosition(anchor.getTransform().getWorldPosition().add(new vec3(...wristOffset(s.bedId))))
    if(s.phase === "emergency"){
      if(anchor && !s.privacy && !s.view.menuOpen){
        const point=anchor.getTransform().getWorldTransform().multiplyPoint(new vec3(...WARD_LAYOUT.approach))
        const eye=cam.getWorldPosition()
        // The bedside is the foot-end approach or the aisle-side standing point, whichever is nearer.
        const stand=this.dashboard()?.stand
        const d=Math.min(Math.hypot(point.x-eye.x,point.z-eye.z),stand?Math.hypot(stand.x-eye.x,stand.z-eye.z):Infinity)
        if(!s.emergencyNear && d<this.bedsideEnterCm)this.dispatch({type:"EMERGENCY_NEAR"})
        else if(s.emergencyNear && d>this.bedsideExitCm)this.dispatch({type:"EMERGENCY_AWAY"})
        s=this.state
      }
      if(!this.state.emergencyNear){
        const offset=this.state.emergencyBrief?new vec3(0,0,-110):new vec3(hudOffset(24,20,s.view.miniCorner).x,hudOffset(24,20,s.view.miniCorner).y,-110)
        const rotation=cam.getWorldRotation()
        const target=cam.getWorldPosition().add(rotation.multiplyVec3(offset)); const k=followAlpha(getDeltaTime());
        t.setWorldPosition(vec3.lerp(t.getWorldPosition(),target,k));t.setWorldRotation(quat.slerp(t.getWorldRotation(),rotation,k))
        this.updateDestination()
        return
      }
    }
    // Screens stay in the view frame, so only the older emergency board (privacy, briefing) follows a bed.
    if(anchor && s.phase === "emergency" && !selectEmergencyScreen(s,0)){
      t.setWorldPosition(anchor.getTransform().getWorldPosition().add(new vec3(WARD_LAYOUT.board[0]*(this.mirrorBoard?-1:1),WARD_LAYOUT.board[1],WARD_LAYOUT.board[2])))
      t.setWorldRotation(quat.fromEulerAngles(0,(this.mirrorBoard?1:-1)*Math.atan2(62,86),0))
    }else {t.setWorldPosition(this.frameInWard(FRAME_CARD));t.setWorldRotation(this.dashboard()?.turn ?? quat.quatIdentity())}
    if(ROUTINE_PROXIMITY && anchor && s.phase !== "emergency" && s.verification === "verified"){
      const d=anchor.getTransform().getWorldPosition().add(new vec3(...WARD_LAYOUT.approach)).distance(cam.getWorldPosition());
      if(this.proximityBed!==s.bedId){this.proximityBed=s.bedId??"";this.routineNear=true}
      const transition=proximityEvent(this.routineNear,d);
      if(transition)this.routineNear=transition==="enter";
      if(transition==="exit")this.dispatch({type:"AWAY_FROM_BED"});
      else if(transition==="enter")this.dispatch({type:"NEAR_BED"});
    }
    this.updateDestination()
  }

  /** Deliberate deviation from the storyboard's static markers: a slow 1 Hz pulse, 100% to 35%, steady under reduced motion. */
  private markerOpacity():number {
    if(this.miniHud.reducedMotion || this.round.reducedMotion)return 1
    return 0.675+0.325*Math.cos(2*Math.PI*getTime())
  }

  /** The bed these screens belong to: Bed 3 during Code Blue, otherwise the one selected. */
  private currentBed(): SceneObject | null {
    const s = this.state
    if (s.phase === "emergency") return this.bed3Anchor ?? null
    const beds = {bed1: this.bed1Anchor, bed2: this.bed2Anchor, bed3: this.bed3Anchor, bed4: this.bed4Anchor}
    return s.bedId === null ? null : beds[s.bedId] ?? null
  }

  /** A point on the current bed, from its authored world position. Null with no bed. */
  private wardPoint(...offsets: readonly (readonly [number, number, number])[]): vec3 | null {
    const bed = this.currentBed()
    if (!bed) return null
    return offsets.reduce((p, o) => p.add(new vec3(o[0], o[1], o[2])), bed.getTransform().getWorldPosition())
  }

  /** The current bed's world-locked dashboard, from its authored position. Null with no bed. */
  private dashboard(): {at: vec3; stand: vec3; turn: quat} | null {
    const bed = this.currentBed()
    if (!bed) return null
    const p = bed.getTransform().getWorldPosition()
    const pose = dashboardPose([p.x, p.y, p.z])
    return {at: new vec3(...pose.position), stand: new vec3(...pose.stand), turn: quat.angleAxis(pose.yaw, vec3.up())}
  }

  /** Moves an older card or the menu with the screens: `point` is in the start-pose frame. */
  private frameInWard(point: vec3): vec3 {
    const d = this.dashboard()
    return d ? d.at.add(d.turn.multiplyVec3(new vec3(point.x, point.y, 0))) : point
  }

  private updateDestination():void {
    const s=this.state
    // Ryan's footprint outline shows for the whole drill; the pin and arrow below are the wayfinding.
    if(s.phase !== "emergency" || s.privacy || !this.bed3Anchor)this.drillDestination?.hide()
    else{
      if(!this.drillDestination)this.drillDestination=new VitaLensEmergencyDestination(this.sceneObject,this.bed3Anchor,this.wrist.material)
      this.drillDestination.showOutline()
    }
    // The Code Blue marker belongs to the travelling view only (s3-em-travel), the blue one to the scan step.
    const travelling=s.phase === "emergency" && !s.privacy && !s.emergencyNear && !s.emergencyBrief && !!this.bed3Anchor
    const scanning=s.phase !== "emergency" && !s.view.minimised && this.wristStage(s) === "scan"
    const tip=travelling?this.bed3Anchor.getTransform().getWorldPosition().add(new vec3(...WARD_LAYOUT.bedPinTip)):scanning?this.wardPoint(wristOffset(s.bedId),WARD_LAYOUT.scanTip):null
    if(!tip){this.round.setDestination(null);this.screen.setBedArrow(null);return}
    const style=travelling?CODE_BLUE_MARKER:SCAN_MARKER
    const cam=this.miniHud.cameraObject.getTransform(),eye=cam.getWorldPosition(),delta=tip.sub(eye)
    const forward=cam.getWorldRotation().multiplyVec3(new vec3(0,0,-1))
    const marker=selectBedMarker(delta.dot(cam.right),delta.dot(cam.up),delta.dot(forward),s.view.miniCorner,travelling)
    if(marker.kind === "pin"){this.round.setDestination(tip,eye,Math.atan2(delta.dot(cam.right),delta.dot(forward)),style);this.screen.setBedArrow(null)}
    else{this.round.setDestination(null);this.screen.setBedArrow(marker,style)}
    const opacity=this.markerOpacity()
    this.round.setDestinationOpacity(opacity);this.screen.setBedArrowOpacity(opacity)
  }

  private renderEmergency(): void {
    if (!this.started) return
    this.drillShown = Math.floor(this.drillSeconds)
    this.round.render(selectCards(this.state,this.drillShown))
    const emergency = selectEmergencyScreen(this.state,this.drillShown)
    if(emergency && this.lastScreen){this.round.setCardShown(false);this.screen.renderEmergency({...this.lastScreen,emergency})}
    if(!emergency && this.state.phase === "emergency" && this.state.emergencyNear && !this.state.privacy)this.miniHud.renderEmergencyStatus(Sel.selectEmergency(this.state,this.drillShown).drillTimer,this.state.emergencyContact)
  }
}
