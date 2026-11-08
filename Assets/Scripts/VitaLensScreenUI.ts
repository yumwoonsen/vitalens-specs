// VitalLens one-panel screens (docs/design/lens-spec.json). Passive view: every screen
// is ONE panel made of the shared top bar, a body and the shared bottom bar. Main owns
// the state and passes selector output in; this module only emits intents.
//
// Scenario 1: s1-shift and the five wristband states; Scenario 2 is drawn by
// VitaLensPatientScreen.ts inside this chrome. Spec measurements, in cm from the panel's
// top-left corner, go through cm() (UI_SCALE). Text keeps its size floors and buttons keep
// 4 cm, so panels are taller than the plain scaled height by what those floors add.
//
// Deliberate deviations from the storyboard:
// - The back plate is PANEL_PLATE, not the 0.35 tint. On the additive display a dark
//   colour adds almost no light, so it reads darker in the browser than in the preview.
// - The Brief is taller for the simulation disclosure line. It grows upward, so the bottom
//   stays where the scaled spec has it.
// - The progress track is narrower than scaled, so the top bar fits its unshrunk text.
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import type {selectIdentity, selectWardFlags} from "./Core/EncounterSelectors"
import type {BedId, EncounterEvent, IdentifierId} from "./Core/EncounterTypes"
import type {DockAction} from "./VitaLensDockUI"
import {HudMesh} from "./VitaLensHudMesh"
import {BED_ARROW, BED_CARD_H, BedMarkerStyle, CODE_BLUE_MARKER, EmergencyCard, EmergencyView, travelCentre, TRAVEL_H, TRAVEL_W} from "./VitaLensEmergencyScreen"
import type {CaptionFrame} from "./Core/LiveCaptions"
import {PatientBody, PatientView, VERIFIED_PILL} from "./VitaLensPatientScreen"
import {Box, box, cm, fontCm, hex, icon, label, obj, PANEL_PLATE, placeBox, placeLabel, setBorder, setShownPanel, setSolidEnabled, setSolidFill, setText, show, solidButton, SolidButton} from "./VitaLensSharedUI"

export type WristStage = "scan" | "name" | "dob" | "verified" | "mismatch"

export interface ScreenControls {
  readonly back: boolean
  readonly privacy: boolean
  readonly minimise: boolean
  readonly emergency: boolean
  readonly next: boolean
  readonly menu: boolean
}

export interface ScreenView {
  /** Null when no one-panel screen owns the view. */
  readonly kind: "shift" | "wristband" | "patient" | "emergency" | null
  readonly ward: ReturnType<typeof selectWardFlags>
  readonly identity: ReturnType<typeof selectIdentity>
  readonly stage: WristStage | null
  readonly patient: PatientView | null
  readonly emergency: EmergencyView | null
  /** The shift screen right after a drill reads as the ward overview (s3-after). */
  readonly afterDrill: boolean
  readonly controls: ScreenControls
}

/** Owner decision, 7 Nov: the first page carries only this sentence, with the "Simulated" chip. The storyboard still has the longer text. */
export const SIMULATION_DISCLOSURE = "All people and records are fictional."

const ICON_BACK = requireAsset("../Icons/Storyboard/back.png") as Texture
const ICON_PRIVACY = requireAsset("../Icons/Storyboard/eyeoff.png") as Texture
const ICON_MINIMISE = requireAsset("../Icons/Storyboard/mini.png") as Texture
const ICON_EMERGENCY = requireAsset("../Icons/Storyboard/emerg.png") as Texture
const ICON_NEXT = requireAsset("../Icons/Storyboard/next.png") as Texture
const ICON_CHECK = requireAsset("../Icons/Storyboard/check.png") as Texture
const ICON_WARNING = requireAsset("../Icons/Storyboard/warn.png") as Texture
const ICON_RESCAN = requireAsset("../Icons/Storyboard/retry.png") as Texture
const ICON_SCAN = requireAsset("../Icons/Storyboard/scan.png") as Texture
const ICON_MENU = requireAsset("../Icons/Storyboard/more.png") as Texture
const ICON_MIC = requireAsset("../Icons/Storyboard/mic.png") as Texture
const ICON_STOP = requireAsset("../Icons/Storyboard/stop.png") as Texture
const RING_MATERIAL = requireAsset("../SimpleVertexBaseColor.lspkg/vertexBaseColorMaterial.mat") as Material

// Colours from the spec.
const C = {
  white: hex("#FFFFFF"),
  soft: hex("#C9D1D8"),
  plateLine: hex("#FFFFFF", 0.16),
  hairline: hex("#FFFFFF", 0.12),
  row: hex("#4B5563"),
  accent: hex("#0F9F8E"),
  core: hex("#5EEAD4"),
  coreDim: hex("#5EEAD4", 0.25),
  ringTrack: hex("#26423F"),
  system: hex("#7DD3FC"),
  // The storyboard's Privacy on chip (#CCFBF1, the rail's teal).
  privacy: hex("#CCFBF1"),
  verified: hex("#34D399"),
  verifiedFill: hex("#34D399", 0.18),
  caution: hex("#FCD34D"),
  red: hex("#EF4444"),
  redFill: hex("#B91C1C"),
  redText: hex("#F87171"),
  emergencyFill: hex("#F87171", 0.1),
  emergencyInk: hex("#FCA5A5"),
  neutralFill: hex("#FFFFFF", 0.12),
  neutralLine: hex("#FFFFFF", 0.3),
  menuFill: hex("#FFFFFF", 0.05),
  clear: hex("#FFFFFF", 0),
}

// Panel placement in view cm at 110 cm, with the eye at the origin at the start pose. Every
// top edge sits below the head-locked strip, whose tab ends near +30.7.
const DISTANCE = 110
/** The view-frame centre at the start pose, for screens with no bed yet. */
const START_FRAME = new vec3(0, 0, -DISTANCE)
const PANEL_W = cm(40)

// Shared bars.
const BAR_H = cm(6.88)
const BAR_PAD = cm(0.88)
const BAR_BTN_Y = cm(0.74)
const BAR_BTN_H = cm(5.4)
const BAR_ICON = cm(2.2)
const BAR_ICON_Y = cm(0.79)
const BAR_LABEL_Y = cm(3.29)
const BAR_LABEL_H = cm(1.32)
// Each bar button is as wide as its measured label plus a little padding, never under the
// 4 cm click target, and what is left of the bar is shared equally between them.
const BAR_LABEL_PAD = 0.3
const barW = (labelW: number): number => Math.max(4, labelW + BAR_LABEL_PAD)
const BAR_W = {back: barW(2.67), privacy: barW(5.71), minimise: barW(5.03), next: barW(2.58)}
const BAR_EMERGENCY = {"Code blue": barW(5.6), Close: barW(3)}
const CHIP_Y = cm(1.34)
const CHIP_H = cm(3.4)
const MENU_W = cm(7.2)
const MENU_ICON = cm(1.9)
/** Menu is drawn at CHIP_H but keeps a 4 cm click area. */
const MENU_HIT = 4
// Top-bar row, from measured text: this is what has to fit in the scaled panel.
const SIM_CHIP_W = 5
const PROGRESS_X = BAR_PAD + SIM_CHIP_W + 0.4
const PROGRESS_STEPS = 7
const PROGRESS_ON = 0.8
const PROGRESS_OFF = 0.4
const PROGRESS_GAP = 0.13
const PROGRESS_H = cm(0.5)
const TITLE_X = PROGRESS_X + PROGRESS_ON + 6 * PROGRESS_OFF + 6 * PROGRESS_GAP + 0.4
const SHIFT_CHIP_X = TITLE_X + 6.14 + 0.4
const WRIST_CHIP_X = TITLE_X + 7.29 + 0.4
const PATIENT_CHIP_X = TITLE_X + 7.22 + 0.4
const REC_CHIP_W = 6.6
const CHIP_W = {noPatient: 5.3, notConfirmed: 6.9, verified: 6, mismatch: 5}
// Privacy on the shift view: "Shift" (about 2.5 cm at 1 cm text), then the Privacy on pill and the No patient chip.
// They end near 25.1 cm, clear of Menu at 25.5 cm on the 32 cm panel.
const SHIFT_SHORT_W = 2.9
const PRIVACY_PILL_W = 5.8
const PRIVACY_PILL_X = TITLE_X + SHIFT_SHORT_W + 0.3
const AFTER_CHIP_X = TITLE_X + 6.5 + 0.4
// The spec's 0.8 cm gap, scaled, between the title and the chip.
const EMERGENCY_CHIP_X = TITLE_X + 4.75 + cm(0.8)
const EMERGENCY_CHIP_W = 8.8
const EMERGENCY_PROGRESS = 5

// Shift overview.
const SHIFT_BODY_END = 40.0 // was 42.8 for the three-line disclosure; one line now
const SHIFT_H = SHIFT_BODY_END + BAR_H
const SHIFT_BOTTOM = cm(-34.55)
const SHIFT_TOP = SHIFT_BOTTOM + SHIFT_H
const SHIFT_CENTRE_X = cm(0.05)
const DISCLOSURE_Y = 37.8
const DISCLOSURE_H = 1.6
const ROW_Y0 = cm(13.82)
const ROW_PITCH = cm(6.4)
const ROW_H_SHIFT = cm(5.6)
const RING_D = cm(3.4)
const RING_THICK = cm(0.28)

// Wristband body. Text keeps its size, so the long caption takes two lines.
const CAPTION_GROW = 1.1
const BODY_X = cm(0.88)
const BODY_W = cm(38.23)
const BODY_R = BODY_X + BODY_W
const END_GAP = cm(1.2)
const ACTION_H = 4
const ICON_SIZE = cm(2.2)
const ICON_Y = (ACTION_H - ICON_SIZE) / 2
const ICON_GAP = 0.4
// Every state uses the compact pill, so all that follows sits this much above the spec.
const PILL_SAVED = cm(4.8) - VERIFIED_PILL.h
const ACTION_Y = cm(24.42) + CAPTION_GROW - PILL_SAVED
const SCAN_Y = cm(24.92) + CAPTION_GROW - PILL_SAVED
const RESCAN_Y = ACTION_Y + ACTION_H + cm(0.8)
const PILL_Y = cm(7.28)
const PILL_H = VERIFIED_PILL.h
const PILL_ICON_Y = PILL_Y + (PILL_H - VERIFIED_PILL.icon) / 2
const PILL_TEXT_X = VERIFIED_PILL.inset + VERIFIED_PILL.icon + VERIFIED_PILL.iconGap
// Measured text at 1.4 cm: "Verified" 5.055, "Not verified" 7.605, "ID mismatch, stop" 11.844.
// A pill with an icon keeps the Verified pill's padding; one without has the inset on both sides.
const PILL_W_NOT_VERIFIED = 7.605 + 2 * VERIFIED_PILL.inset
const PILL_W_MISMATCH = VERIFIED_PILL.w - 5.055 + 11.844
const PILL_W: {readonly [K in WristStage]: number} = {scan: PILL_W_NOT_VERIFIED, name: PILL_W_NOT_VERIFIED, dob: PILL_W_NOT_VERIFIED, verified: VERIFIED_PILL.w, mismatch: PILL_W_MISMATCH}
// The verified and mismatch captions take one line, so their rows move up by one more step.
// The verified panel also keeps its bottom edge, where the others keep their top edge.
const ONE_LINE_UP = CAPTION_GROW
const VERIFIED_TOP_DROP = PILL_SAVED + CAPTION_GROW
const BED_H = cm(1.67)
const BED_Y = PILL_Y + (PILL_H - BED_H) / 2
const CAPTION_Y = cm(12.88) - PILL_SAVED
const LINE_Y = cm(15.7) + CAPTION_GROW - PILL_SAVED
const ROW1_Y = cm(16.98) + CAPTION_GROW - PILL_SAVED
const ROW2_Y = cm(20.08) + CAPTION_GROW - PILL_SAVED
const ROW_H = cm(1.89)
const CHECK_SIZE = cm(1.6)
const CHECK_GAP = cm(0.3)
const CHECK_Y = ROW1_Y + (ROW_H - CHECK_SIZE) / 2
// Wristband value parts once split: measured text widths, right-aligned.
const BAND_DOB_W = 7.4
const BAND_NAME_W = 11.3
const WRIST_H: {readonly [K in WristStage]: number} = {
  scan: SCAN_Y + ACTION_H + END_GAP + BAR_H,
  name: RESCAN_Y + ACTION_H + END_GAP + BAR_H,
  dob: RESCAN_Y + ACTION_H + END_GAP + BAR_H,
  verified: ROW2_Y - ONE_LINE_UP + ROW_H + END_GAP + BAR_H,
  mismatch: RESCAN_Y - ONE_LINE_UP + ACTION_H + END_GAP + BAR_H,
}

const PATIENT_TOP = cm(20.45)
const PATIENT_CENTRE_X = cm(0.05)

// Scenario 3, from the s3-* states.
const EMERGENCY_CARD_Y = cm(7.28)
const EMERGENCY_TOP = cm(20.49)
const EMERGENCY_END_GAP = cm(1.2)
const CORNER_W = cm(17)
const CORNER_H = cm(4.75)
const CORNER_HIT = 4
const ARROW_ICON = cm(2.2)
const ARROW_TEXT_W = 4.4
const ARROW_PAD = (BED_ARROW.w - ARROW_TEXT_W - ARROW_ICON) / 2
// elements_view_cm.trav: x is about the panel's centre, 13.55 and -13.47 in the spec.
const CORNER_X = cm(13.51)
const CORNER_Y = cm(28.06)
const CORNER_PAD = cm(0.8)

interface Chrome {
  readonly root: SceneObject
  /** Parent for the panel's parts: origin at the panel's top-left corner. */
  readonly content: SceneObject
  readonly plate: BackPlate
  readonly bar: SceneObject
  readonly dots: Box[]
  readonly title: Text
  readonly chip: Box
  readonly chipText: Text
  readonly chipX: number
  readonly controls: {readonly [K in DockAction | "menu"]: SolidButton}
}

@component
export class VitaLensScreenUI extends BaseScriptComponent {
  private readonly _onDock = new Event<DockAction>()
  private readonly _onMenu = new Event<void>()
  private readonly _onSelectBed = new Event<BedId>()
  private readonly _onScan = new Event<void>()
  private readonly _onConfirm = new Event<IdentifierId>()
  private readonly _onRescan = new Event<void>()
  private readonly _onIntent = new Event<EncounterEvent>()
  get onDock(): PublicApi<DockAction> {
    return this._onDock.publicApi()
  }
  get onMenu(): PublicApi<void> {
    return this._onMenu.publicApi()
  }
  get onSelectBed(): PublicApi<BedId> {
    return this._onSelectBed.publicApi()
  }
  get onScan(): PublicApi<void> {
    return this._onScan.publicApi()
  }
  get onConfirm(): PublicApi<IdentifierId> {
    return this._onConfirm.publicApi()
  }
  /** Patient and note screens emit encounter events directly; Main dispatches them. */
  get onIntent(): PublicApi<EncounterEvent> {
    return this._onIntent.publicApi()
  }
  get onRescan(): PublicApi<void> {
    return this._onRescan.publicApi()
  }

  private shift!: Chrome
  private wrist!: Chrome
  private patient!: Chrome
  private emergency!: Chrome
  private bedCard!: EmergencyCard
  private travelRoot!: SceneObject
  private travelCard!: EmergencyCard
  private cornerRoot!: SceneObject
  private cameraObject: SceneObject | null = null
  /** Ward point the view-frame centre maps to. Null keeps a screen in the start-pose frame. */
  private bedsideFrame: vec3 | null = null
  private bedsideTurn: quat = quat.quatIdentity()
  private headLocked: EmergencyView | null = null
  private cornerBtn!: SolidButton
  private arrowRoot!: SceneObject
  private arrowFill!: Box
  private arrowText!: Text
  private arrowIcon!: Image
  private bedArrow: {x: number; y: number; angle: number} | null = null
  private arrowStyle: BedMarkerStyle = CODE_BLUE_MARKER
  private patientBody!: PatientBody
  private recChip!: Box
  private recChipText!: Text
  private eyebrow!: Text
  private heading!: Text
  private sub!: Text
  private rows: {button: SolidButton; number: Text; name: Text; line: Text; due: Text}[] = []
  private rings: HudMesh[] = []
  private ringKey = ""
  private counterValues: Text[] = []
  private counterLabels: Text[] = []

  private pill!: Box
  private pillText!: Text
  private pillOk!: Image
  private pillBad!: Image
  private bedText!: Text
  private caption!: Text
  private wristLine!: Box
  private bandLabel!: Text
  private expectedLabel!: Text
  private bandWhole!: Text
  private bandName!: Text
  private bandSep!: Text
  private bandDob!: Text
  private bandNameCheck!: Image
  private bandDobCheck!: Image
  private expected!: Text
  private scanBtn!: SolidButton
  private nameBtn!: SolidButton
  private dobBtn!: SolidButton
  private rescanBtn!: SolidButton

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.shift = this.buildChrome("ShiftScreen", SHIFT_H, SHIFT_CHIP_X, CHIP_W.noPatient)
    this.buildShiftBody(this.shift.content)
    this.wrist = this.buildChrome("WristbandScreen", WRIST_H.name, WRIST_CHIP_X, CHIP_W.notConfirmed)
    this.buildWristBody(this.wrist.content)
    this.patient = this.buildChrome("PatientScreen", WRIST_H.name, PATIENT_CHIP_X, CHIP_W.verified)
    this.patientBody = new PatientBody(this.patient.content, {next: ICON_NEXT, back: ICON_BACK, mic: ICON_MIC, stop: ICON_STOP, check: ICON_CHECK}, (e) => this._onIntent.invoke(e))
    this.recChip = box(this.patient.content, TITLE_X, CHIP_Y, REC_CHIP_W, CHIP_H, C.clear, CHIP_H / 2, {w: 0.08, c: C.redText})
    this.recChipText = label(this.patient.content, TITLE_X, CHIP_Y, REC_CHIP_W, CHIP_H, "", 1, 400, C.redText, {align: "center", name: "ScreenRec"})
    this.emergency = this.buildChrome("EmergencyScreen", WRIST_H.name, EMERGENCY_CHIP_X, EMERGENCY_CHIP_W, "Close")
    this.bedCard = new EmergencyCard(this.emergency.content, BODY_X, EMERGENCY_CARD_Y, BODY_W, BED_CARD_H, false, (e) => this._onIntent.invoke(e))
    this.buildHeadLocked()
    show(this.shift.root, false)
    show(this.wrist.root, false)
    show(this.patient.root, false)
    show(this.emergency.root, false)
    this.createEvent("LateUpdateEvent").bind(() => this.lockToHead())
  }

  /** Main passes the camera; the travelling HUD and corner chip are rigidly head-locked. */
  setCamera(camera: SceneObject): void {
    this.cameraObject = camera
  }

  /** Main passes the ward point before each render; the panels stay put in the ward. */
  setWardFrame(bedside: vec3 | null, bedsideTurn: quat): void {
    this.bedsideFrame = bedside
    this.bedsideTurn = bedsideTurn
  }

  private buildHeadLocked(): void {
    this.travelRoot = obj(this.sceneObject, "EmergencyTravel")
    const host = obj(this.travelRoot, "EmergencyTravelPlate", new vec3(TRAVEL_W / 2, -TRAVEL_H / 2, 0))
    const content = obj(host, "EmergencyTravelContent", new vec3(-TRAVEL_W / 2, TRAVEL_H / 2, 0))
    const plate = host.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(TRAVEL_W, TRAVEL_H)
    plate.style = "simple"
    plate.onInitialized.add(() => {
      const rr = host.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      rr.gradient = false
      rr.backgroundColor = PANEL_PLATE
      rr.cornerRadius = cm(1.2)
    })
    this.travelCard = new EmergencyCard(content, 0, 0, TRAVEL_W, TRAVEL_H, true, (e) => this._onIntent.invoke(e))
    this.cornerRoot = obj(this.sceneObject, "EmergencyCorner")
    const corner = this.cornerBtn = solidButton(this.cornerRoot, "BtnEmergencyCorner", 0, 0, CORNER_W, CORNER_H, PANEL_PLATE, cm(1.2), () => {
      if (this.headLocked) this._onIntent.invoke(this.headLocked.cornerEvent)
    }, {w: 0.17, c: C.red}, CORNER_HIT)
    label(corner.face, CORNER_PAD, 0.3, CORNER_W - 2 * CORNER_PAD, 1.5, "Bed 3 · here", 1.17, 600, C.white, {name: "EmergencyCornerTitle"})
    label(corner.face, CORNER_PAD, 1.95, CORNER_W - 2 * CORNER_PAD, 1.5, "Code Blue drill", 1.17, 400, C.soft, {name: "EmergencyCornerSub"})
    this.arrowRoot = obj(this.sceneObject, "EmergencyBedArrow")
    this.arrowFill = box(this.arrowRoot, 0, 0, BED_ARROW.w, BED_ARROW.h, C.redFill, BED_ARROW.h / 2)
    this.arrowText = label(this.arrowRoot, 0, 0, ARROW_TEXT_W, BED_ARROW.h, "Bed 3", 1.6, 700, C.white, {align: "center", name: "EmergencyBedArrowLabel"})
    this.arrowIcon = icon(this.arrowRoot, ICON_NEXT, 0, (BED_ARROW.h - ARROW_ICON) / 2, ARROW_ICON, C.white)
    show(this.travelRoot, false)
    show(this.cornerRoot, false)
    show(this.arrowRoot, false)
  }

  /** The edge arrow towards the target, in view cm; null while the pin shows it or nothing needs it. */
  setBedArrow(arrow: {x: number; y: number; angle: number} | null, style: BedMarkerStyle = CODE_BLUE_MARKER): void {
    this.bedArrow = arrow
    show(this.arrowRoot, arrow !== null)
    if (!arrow) return
    if (style !== this.arrowStyle) {
      this.arrowStyle = style
      this.arrowFill.rr.backgroundColor = style.fill
      setText(this.arrowText, style.arrowLabel, style.ink)
      this.arrowIcon.mainPass.baseColor = style.ink
    }
    // The arrow leads when it points left.
    const left = Math.cos(arrow.angle) < 0
    const iconX = left ? ARROW_PAD : BED_ARROW.w - ARROW_PAD - ARROW_ICON
    placeIcon(this.arrowIcon, iconX, (BED_ARROW.h - ARROW_ICON) / 2)
    this.arrowIcon.getSceneObject().getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, arrow.angle))
    placeLabel(this.arrowText, left ? ARROW_PAD + ARROW_ICON : ARROW_PAD, 0, ARROW_TEXT_W, BED_ARROW.h)
  }

  setBedArrowOpacity(a: number): void {
    const f = this.arrowFill.rr.backgroundColor
    this.arrowFill.rr.backgroundColor = new vec4(f.x, f.y, f.z, a)
    const t = this.arrowText.textFill.color
    this.arrowText.textFill.color = new vec4(t.x, t.y, t.z, a)
    const i = this.arrowIcon.mainPass.baseColor
    this.arrowIcon.mainPass.baseColor = new vec4(i.x, i.y, i.z, a)
  }

  private lockToHead(): void {
    if (!this.cameraObject) return
    const cam = this.cameraObject.getTransform()
    const rot = cam.getWorldRotation()
    const at = (x: number, y: number): vec3 => cam.getWorldPosition().add(rot.multiplyVec3(new vec3(x, y, -DISTANCE)))
    if (this.bedArrow) {
      this.arrowRoot.getTransform().setWorldPosition(at(this.bedArrow.x - BED_ARROW.w / 2, this.bedArrow.y + BED_ARROW.h / 2))
      this.arrowRoot.getTransform().setWorldRotation(rot)
    }
    const v = this.headLocked
    if (!v) return
    if (v.surface === "travel") {
      const c = travelCentre(v.corner)
      this.travelRoot.getTransform().setWorldPosition(at(c.x - TRAVEL_W / 2, c.y + TRAVEL_H / 2))
      this.travelRoot.getTransform().setWorldRotation(rot)
    } else {
      // In the panel's plane, like the panel itself: locked to the head it drifts behind the
      // top bar as soon as the camera leaves the view origin.
      const side = v.corner === "right" ? 1 : -1
      const o = this.bedsideFrame ?? START_FRAME
      const turn = this.bedsideFrame ? this.bedsideTurn : quat.quatIdentity()
      this.cornerRoot.getTransform().setWorldPosition(o.add(turn.multiplyVec3(new vec3(PATIENT_CENTRE_X + side * CORNER_X - CORNER_W / 2, CORNER_Y + CORNER_H / 2, 0))))
      this.cornerRoot.getTransform().setWorldRotation(turn)
    }
  }

  // ---------------------------------------------------------------- shared bars

  private buildChrome(name: string, h: number, chipX: number, chipW: number, emergencyLabel: "Code blue" | "Close" = "Code blue"): Chrome {
    const w = PANEL_W
    const emergencyW = BAR_EMERGENCY[emergencyLabel]
    const barGap = (w - 2 * BAR_PAD - (BAR_W.back + BAR_W.privacy + BAR_W.minimise + emergencyW + BAR_W.next)) / 4
    const top = obj(this.sceneObject, name)
    const plateHost = obj(top, name + "Plate", new vec3(w / 2, -h / 2, 0))
    // Everything is a descendant of the plate: its interaction plane blocks siblings.
    const root = obj(plateHost, name + "Content", new vec3(-w / 2, h / 2, 0))
    const plate = plateHost.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(w, h)
    plate.style = "simple"
    plate.onInitialized.add(() => {
      const rr = plateHost.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      rr.gradient = false
      rr.backgroundColor = PANEL_PLATE
      rr.cornerRadius = cm(1.2)
      setBorder(rr, {w: 0.08, c: C.plateLine})
    })

    // Top bar: Simulated, progress and title, patient or ID chip, Menu.
    box(root, BAR_PAD, CHIP_Y, SIM_CHIP_W, CHIP_H, C.clear, CHIP_H / 2, {w: 0.08, c: C.system})
    label(root, BAR_PAD, CHIP_Y, SIM_CHIP_W, CHIP_H, "Simulated", 1, 400, C.system, {align: "center", name: "ScreenSimulated"})
    const dots: Box[] = []
    for (let i = 0; i < PROGRESS_STEPS; i++) dots.push(box(root, PROGRESS_X, CHIP_Y + (CHIP_H - PROGRESS_H) / 2, PROGRESS_OFF, PROGRESS_H, C.coreDim, 0.1))
    const title = label(root, TITLE_X, CHIP_Y, chipX - TITLE_X - 0.1, CHIP_H, "", 1, 400, C.white, {name: "ScreenTitle"})
    const chip = box(root, chipX, CHIP_Y, chipW, CHIP_H, C.clear, CHIP_H / 2, {w: 0.08, c: C.white})
    const chipText = label(root, chipX, CHIP_Y, chipW, CHIP_H, "", 1, 400, C.white, {align: "center", name: "ScreenChip"})
    const menuX = w - BAR_PAD - MENU_W
    const menu = solidButton(root, "BtnMenu", menuX, CHIP_Y, MENU_W, CHIP_H, C.menuFill, CHIP_H / 2, () => this._onMenu.invoke(), undefined, MENU_HIT)
    menu.icons.push(icon(menu.face, ICON_MENU, cm(0.78), (CHIP_H - MENU_ICON) / 2, MENU_ICON, C.white))
    menu.labels.push(label(menu.face, cm(3.18), 0, 3.1, CHIP_H, "Menu", 1.2, 600, C.white, {align: "center"}))

    // Bottom bar: Back, Privacy on, Minimise, Code blue, Next.
    const bar = obj(root, name + "Bar", new vec3(0, -(h - BAR_H), 0))
    box(bar, 0.08, 0, w - 0.16, 0.08, C.hairline)
    let barX = BAR_PAD
    const add = (action: DockAction, bw: number, btnName: string, text: string, tex: Texture, ink: vec4, fill: vec4): SolidButton => {
      const b = solidButton(bar, btnName, barX, BAR_BTN_Y, bw, BAR_BTN_H, fill, cm(1.2), () => this._onDock.invoke(action))
      barX += bw + barGap
      b.icons.push(icon(b.face, tex, (bw - BAR_ICON) / 2, BAR_ICON_Y, BAR_ICON, ink))
      b.labels.push(label(b.face, 0, BAR_LABEL_Y, bw, BAR_LABEL_H, text, 1.2, 600, ink, {align: "center"}))
      return b
    }
    const controls = {
      back: add("back", BAR_W.back, "BtnBack", "Back", ICON_BACK, C.white, C.clear),
      privacy: add("privacy", BAR_W.privacy, "BtnPrivacy", "Privacy on", ICON_PRIVACY, C.white, C.clear),
      minimise: add("minimise", BAR_W.minimise, "BtnMinimise", "Minimise", ICON_MINIMISE, C.white, C.clear),
      emergency: add("emergency", emergencyW, "BtnEmergency", emergencyLabel, ICON_EMERGENCY, C.emergencyInk, C.emergencyFill),
      next: add("next", BAR_W.next, "BtnNext", "Next", ICON_NEXT, C.white, C.clear),
      menu,
    }
    return {root: top, content: root, plate, bar, dots, title, chip, chipText, chipX, controls}
  }

  private setProgress(c: Chrome, current: number): void {
    let x = PROGRESS_X
    const y = CHIP_Y + (CHIP_H - PROGRESS_H) / 2
    c.dots.forEach((d, i) => {
      const w = i === current ? PROGRESS_ON : PROGRESS_OFF
      placeBox(d, x, y, w, PROGRESS_H)
      d.rr.backgroundColor = i === current ? C.core : C.coreDim
      x += w + PROGRESS_GAP
    })
  }

  private setControls(c: Chrome, v: ScreenControls): void {
    for (const k of Object.keys(c.controls) as (keyof Chrome["controls"])[]) setSolidEnabled(c.controls[k], v[k])
  }

  private setChip(c: Chrome, text: string, color: vec4, w: number, x: number = c.chipX): void {
    placeBox(c.chip, x, CHIP_Y, w, CHIP_H)
    placeLabel(c.chipText, x, CHIP_Y, w, CHIP_H)
    setText(c.chipText, text, color)
    setBorder(c.chip.rr, {w: 0.08, c: color})
  }

  /** Sizes the plate, content and bottom bar for a panel of height h. */
  private fit(c: Chrome, h: number): void {
    c.plate.size = new vec2(PANEL_W, h)
    c.plate.getSceneObject().getTransform().setLocalPosition(new vec3(PANEL_W / 2, -h / 2, 0))
    c.content.getTransform().setLocalPosition(new vec3(-PANEL_W / 2, h / 2, 0))
    c.bar.getTransform().setLocalPosition(new vec3(0, -(h - BAR_H), 0))
  }

  // ---------------------------------------------------------------- s1-shift

  private buildShiftBody(root: SceneObject): void {
    const x = BODY_X
    const w = BODY_W
    this.eyebrow = label(root, x, cm(7.28), w, 1.4, "", 1.17, 400, C.soft, {name: "BriefEyebrow"})
    this.heading = label(root, x, cm(8.78), w, 2, "", fontCm(1.8), 700, C.white, {name: "BriefTitle"})
    this.sub = label(root, x, cm(11.2), w, 1.4, "", 1.17, 400, C.soft, {name: "BriefSub"})
    const beds: BedId[] = ["bed1", "bed2", "bed3", "bed4"]
    beds.forEach((bedId, i) => {
      const n = i + 1
      const primary = bedId === "bed2"
      const b = solidButton(root, "BtnBed" + n, x, ROW_Y0 + i * ROW_PITCH, w, ROW_H_SHIFT, primary ? C.accent : C.row, cm(0.9), () => this._onSelectBed.invoke(bedId))
      const d = cm(2.8)
      box(b.face, cm(0.69), cm(1.4), d, d, C.neutralFill, d / 2, {w: 0.08, c: C.neutralLine}, true)
      const number = label(b.face, cm(0.69), cm(1.4), d, d, "", 1.6, 700, C.white, {align: "center", name: "BedNumber" + n})
      const name = label(b.face, cm(4.28), cm(1), cm(25.8), cm(1.85), "", 1.4, 600, C.white, {name: "BedName" + n})
      const line = label(b.face, cm(4.28), cm(2.9), cm(25.8), cm(1.65), "", 1.17, 400, C.white, {name: "BedLine" + n})
      const due = label(b.face, cm(34.56) - 4.2, cm(1.97), 4.2, cm(1.67), "", 1.4, 600, C.white, {align: "right", name: "BedDue" + n})
      if (primary) icon(b.face, ICON_NEXT, cm(35.36), cm(1.7), cm(2.2), C.white)
      this.rows.push({button: b, number, name, line, due})
    })
    box(root, x, cm(40.32), w, 0.08, C.hairline)
    const centres = [cm(7.06), cm(20), cm(32.95)]
    const ringY = cm(41.6)
    const labelY = cm(45.3)
    centres.forEach((c, i) => {
      const host = obj(root, "BriefRing" + (i + 1), new vec3(c, -(ringY + RING_D / 2), 0.7))
      this.rings.push(new HudMesh(host, RING_MATERIAL))
      ;(host.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(11)
      this.counterValues.push(label(root, c - RING_D / 2, ringY, RING_D, RING_D, "", 1.4, 700, C.white, {align: "center", name: "BriefCountValue" + (i + 1)}))
      this.counterLabels.push(label(root, c - cm(6.17), labelY, cm(12.35), 1.3, "", 1.2, 500, C.soft, {align: "center", name: "BriefCountLabel" + (i + 1)}))
    })
    label(root, x, DISCLOSURE_Y, w, DISCLOSURE_H, SIMULATION_DISCLOSURE, 1.17, 400, C.system, {name: "BriefDisclosure", wrap: true})
  }

  /** Each ring fills by its count out of the assigned beds, clockwise from the top. */
  private renderRings(values: number[]): void {
    const key = values.join(",")
    if (key === this.ringKey) return
    this.ringKey = key
    const of = Math.max(1, values[0])
    const outer = RING_D / 2
    const inner = outer - RING_THICK
    this.rings.forEach((mesh, i) => {
      const fraction = Math.min(1, (values[i] ?? 0) / of)
      const end = 90
      const start = end - 360 * fraction
      mesh.clear().arc(inner, outer, end - 360, start, C.ringTrack).arc(inner, outer, start, end, C.core).commit()
    })
  }

  private renderShift(v: ScreenView): void {
    const c = this.shift
    this.place(c, SHIFT_CENTRE_X - PANEL_W / 2, SHIFT_TOP, SHIFT_H)
    this.setProgress(c, 0)
    const after = v.afterDrill
    placeLabel(c.title, TITLE_X, CHIP_Y, (after ? AFTER_CHIP_X : SHIFT_CHIP_X) - TITLE_X - 0.1, CHIP_H)
    setText(c.title, after ? "After the drill" : "Shift overview")
    const chipX = after ? AFTER_CHIP_X : SHIFT_CHIP_X
    placeBox(c.chip, chipX, CHIP_Y, CHIP_W.noPatient, CHIP_H)
    placeLabel(c.chipText, chipX, CHIP_Y, CHIP_W.noPatient, CHIP_H)
    setText(c.chipText, "No patient", C.white)
    setBorder(c.chip.rr, {w: 0.08, c: C.white})
    this.setControls(c, v.controls)
    setText(this.eyebrow, v.ward.header.eyebrow)
    setText(this.heading, after ? "Ward overview" : v.ward.header.title)
    setText(this.sub, after ? "No active encounter. Select a bed to verify again." : v.ward.header.sub)
    v.ward.brief.forEach((row, i) => {
      const r = this.rows[i]
      if (!r) return
      setText(r.number, String(row.bedNumber))
      setText(r.name, row.name)
      setText(r.line, row.row)
      setText(r.due, row.due)
      setSolidEnabled(r.button, row.select.enabled)
    })
    v.ward.counters.forEach((k, i) => {
      if (this.counterValues[i]) setText(this.counterValues[i], String(k.value))
      if (this.counterLabels[i]) setText(this.counterLabels[i], k.label)
    })
    this.renderRings(v.ward.counters.map((k) => k.value))
  }

  // ---------------------------------------------------------------- s1-wb-*

  private buildWristBody(root: SceneObject): void {
    this.pill = box(root, BODY_X, PILL_Y, PILL_W.name, PILL_H, C.neutralFill, PILL_H / 2, {w: 0.08, c: C.neutralLine})
    this.pillOk = icon(root, ICON_CHECK, BODY_X + VERIFIED_PILL.inset, PILL_ICON_Y, VERIFIED_PILL.icon, C.verified)
    this.pillBad = icon(root, ICON_WARNING, BODY_X + VERIFIED_PILL.inset, PILL_ICON_Y, VERIFIED_PILL.icon, C.white)
    this.pillText = label(root, BODY_X, PILL_Y, PILL_W.name, PILL_H, "", VERIFIED_PILL.font, 700, C.white, {align: "center", name: "IdentityPill"})
    this.bedText = label(root, BODY_R - 3.9, BED_Y, 3.9, BED_H, "", 1.4, 600, C.white, {align: "right", name: "IdentityBed"})
    this.caption = label(root, BODY_X, CAPTION_Y, BODY_W, 2.9, "", 1.2, 500, C.soft, {name: "IdentityCaption", wrap: true})
    this.wristLine = box(root, BODY_X, LINE_Y, BODY_W, 0.08, C.hairline)

    this.bandLabel = label(root, BODY_X, ROW1_Y, 6, ROW_H, "Wristband", 1.2, 500, C.soft, {name: "IdentityBandLabel"})
    this.bandWhole = label(root, BODY_R - 24.25, ROW1_Y, 24.25, ROW_H, "", 1.4, 600, C.white, {align: "right", name: "IdentityBand"})
    this.bandName = label(root, 0, ROW1_Y, BAND_NAME_W, ROW_H, "", 1.4, 600, C.verified, {align: "right", name: "IdentityBandName"})
    this.bandSep = label(root, 0, ROW1_Y, 1, ROW_H, "·", 1.4, 600, C.white, {align: "center"})
    this.bandDob = label(root, BODY_R - BAND_DOB_W, ROW1_Y, BAND_DOB_W, ROW_H, "", 1.4, 600, C.white, {align: "right", name: "IdentityBandDob"})
    this.bandNameCheck = icon(root, ICON_CHECK, 0, CHECK_Y, CHECK_SIZE, C.verified)
    this.bandDobCheck = icon(root, ICON_CHECK, 0, CHECK_Y, CHECK_SIZE, C.verified)
    this.expectedLabel = label(root, BODY_X, ROW2_Y, 7, ROW_H, "Bed expects", 1.2, 500, C.soft, {name: "IdentityExpectedLabel"})
    this.expected = label(root, BODY_R - 24.25, ROW2_Y, 24.25, ROW_H, "", 1.4, 600, C.white, {align: "right", name: "IdentityExpected"})

    this.scanBtn = this.primary(root, "BtnScanWristband", "Scan", SCAN_Y, 3.54, () => this._onScan.invoke(), ICON_SCAN)
    this.nameBtn = this.primary(root, "BtnConfirmName", "Name matches", ACTION_Y, 11, () => this._onConfirm.invoke("name"))
    this.dobBtn = this.primary(root, "BtnConfirmDob", "DOB matches", ACTION_Y, 10, () => this._onConfirm.invoke("dob"))
    const r = solidButton(root, "BtnRescan", BODY_X, RESCAN_Y, BODY_W, ACTION_H, C.row, ACTION_H / 2, () => this._onRescan.invoke())
    const textW = 4.62
    const x = (BODY_W - (ICON_SIZE + ICON_GAP + textW)) / 2
    r.icons.push(icon(r.face, ICON_RESCAN, x, ICON_Y, ICON_SIZE, C.white))
    r.labels.push(label(r.face, x + ICON_SIZE + ICON_GAP, 0, textW + 0.2, ACTION_H, "Rescan", 1.4, 600, C.white))
    this.rescanBtn = r
  }

  /** A full-width primary: label then icon, centred as a group from the measured text width. */
  private primary(root: SceneObject, name: string, text: string, y: number, textW: number, onTap: () => void, tex: Texture = ICON_NEXT): SolidButton {
    const b = solidButton(root, name, BODY_X, y, BODY_W, ACTION_H, C.accent, ACTION_H / 2, onTap)
    const x = (BODY_W - (textW + ICON_GAP + ICON_SIZE)) / 2
    b.labels.push(label(b.face, x, 0, textW + 0.2, ACTION_H, text, 1.6, 600, C.white))
    b.icons.push(icon(b.face, tex, x + textW + ICON_GAP, ICON_Y, ICON_SIZE, C.white))
    return b
  }

  private renderWrist(v: ScreenView, stage: WristStage): void {
    const c = this.wrist
    const h = WRIST_H[stage]
    const ok = stage === "verified"
    const bad = stage === "mismatch"
    const up = ok || bad ? ONE_LINE_UP : 0
    this.place(c, PATIENT_CENTRE_X - PANEL_W / 2, PATIENT_TOP - (ok ? VERIFIED_TOP_DROP : 0), h, this.bedsideFrame, this.bedsideTurn)
    this.fit(c, h)
    this.setProgress(c, 1)
    setText(c.title, "Wristband check")
    this.setControls(c, v.controls)

    const id = v.identity
    const nameRow = id.rows[0]
    const dobRow = id.rows[1]
    const initials = id.chip.text.split(" ")[0]
    if (bad) this.setChip(c, "Mismatch", C.redText, CHIP_W.mismatch)
    else if (ok) this.setChip(c, initials + " verified", C.verified, CHIP_W.verified)
    else this.setChip(c, "Not confirmed", C.caution, CHIP_W.notConfirmed)

    // Pill.
    const pillW = PILL_W[stage]
    placeBox(this.pill, BODY_X, PILL_Y, pillW, PILL_H)
    this.pill.rr.backgroundColor = ok ? C.verifiedFill : C.neutralFill
    setBorder(this.pill.rr, bad ? {w: 0.17, c: C.red} : ok ? {w: 0.08, c: C.verified} : {w: 0.08, c: C.neutralLine})
    if (ok || bad) placeLabel(this.pillText, BODY_X + PILL_TEXT_X, PILL_Y, pillW - PILL_TEXT_X - VERIFIED_PILL.end, PILL_H)
    else placeLabel(this.pillText, BODY_X, PILL_Y, pillW, PILL_H)
    setText(this.pillText, bad ? "ID mismatch, stop" : ok ? "Verified" : "Not verified", ok ? C.verified : C.white)
    show(this.pillOk.getSceneObject(), ok)
    show(this.pillBad.getSceneObject(), bad)
    setText(this.bedText, id.bedLabel ?? "")

    // Rows follow the pill and caption.
    placeLabel(this.caption, BODY_X, CAPTION_Y, BODY_W, up > 0 ? 1.62 : 2.9)
    placeBox(this.wristLine, BODY_X, LINE_Y - up, BODY_W, 0.08)
    const row1 = ROW1_Y - up
    const row2 = ROW2_Y - up
    const checkY = CHECK_Y - up
    placeLabel(this.bandLabel, BODY_X, row1, 6, ROW_H)
    placeLabel(this.bandWhole, BODY_R - 24.25, row1, 24.25, ROW_H)
    placeLabel(this.bandDob, BODY_R - BAND_DOB_W, row1, BAND_DOB_W, ROW_H)
    placeLabel(this.expectedLabel, BODY_X, row2, 7, ROW_H)
    placeLabel(this.expected, BODY_R - 24.25, row2, 24.25, ROW_H)

    setText(
      this.caption,
      bad ? "The scanned band does not match this assignment." : ok ? "Name + DOB verified" : "Confirm the full name and date of birth before documentation.",
      bad ? C.redText : C.soft,
    )

    // Wristband value: one line, or name and date of birth apart once the name is confirmed.
    const bandNameValue = nameRow ? nameRow.wristband ?? "" : ""
    const bandDobValue = dobRow ? dobRow.wristband ?? "" : ""
    const split = stage === "dob" || ok
    show(this.bandWhole.getSceneObject(), !split)
    for (const t of [this.bandName, this.bandSep, this.bandDob]) show(t.getSceneObject(), split)
    show(this.bandNameCheck.getSceneObject(), split)
    show(this.bandDobCheck.getSceneObject(), ok)
    if (split) {
      const dobLeft = BODY_R - 7.2 - (ok ? CHECK_SIZE + CHECK_GAP : 0)
      if (ok) placeIcon(this.bandDobCheck, dobLeft, checkY)
      placeLabel(this.bandSep, dobLeft - 1.1, row1, 1, ROW_H)
      const nameLeft = dobLeft - 1.2 - BAND_NAME_W
      placeLabel(this.bandName, nameLeft, row1, BAND_NAME_W, ROW_H)
      placeIcon(this.bandNameCheck, nameLeft - CHECK_SIZE - CHECK_GAP + 0.1, checkY)
      setText(this.bandName, bandNameValue, C.verified)
      setText(this.bandDob, bandDobValue, ok ? C.verified : C.white)
    } else if (stage === "scan") setText(this.bandWhole, "Aim at the patient’s wristband", C.soft)
    else setText(this.bandWhole, bandNameValue + " · " + bandDobValue, bad ? C.redText : C.white)
    setText(this.expected, (nameRow ? nameRow.assignment : "") + " · " + (dobRow ? dobRow.assignment : ""))

    // Actions.
    for (const [b, y] of [[this.nameBtn, ACTION_Y - up], [this.rescanBtn, RESCAN_Y - up]] as const) {
      const p = b.cell.getTransform().getLocalPosition()
      b.cell.getTransform().setLocalPosition(new vec3(p.x, -y, p.z))
    }
    show(this.scanBtn.cell, stage === "scan")
    show(this.nameBtn.cell, stage === "name" || bad)
    show(this.dobBtn.cell, stage === "dob")
    show(this.rescanBtn.cell, stage === "name" || stage === "dob" || bad)
    setSolidEnabled(this.scanBtn, id.scan.enabled)
    setSolidFill(this.nameBtn, bad ? C.row : C.accent)
    setSolidEnabled(this.nameBtn, !bad && nameRow !== undefined && nameRow.confirm.enabled)
    setSolidEnabled(this.dobBtn, dobRow !== undefined && dobRow.confirm.enabled)
    setSolidEnabled(this.rescanBtn, id.rescan.enabled)
  }

  // ---------------------------------------------------------------- s2-*

  /** Live captions on the recording screen (null clears). Updates the words only, without a full render. */
  setCaptions(frame: CaptionFrame | null): void {
    this.patientBody.setCaptions(frame)
  }

  private renderPatient(v: ScreenView, p: PatientView): void {
    const c = this.patient
    this.place(c, PATIENT_CENTRE_X - PANEL_W / 2, PATIENT_TOP, p.height, this.bedsideFrame, this.bedsideTurn)
    this.fit(c, p.height)
    this.setProgress(c, p.progress)
    const rec = p.stage === "recording"
    const hidden = p.stage === "privacy"
    // The title is a pill while recording and while details are hidden. With no patient chosen
    // (storyboard rail on the shift view) the short view name stays, then the pill, then "No patient".
    const pill = rec || hidden
    const shiftPrivacy = hidden && p.noPatient
    const pillInk = rec ? C.redText : hidden ? C.privacy : C.white
    const pillX = shiftPrivacy ? PRIVACY_PILL_X : TITLE_X
    const pillW = shiftPrivacy ? PRIVACY_PILL_W : REC_CHIP_W
    show(c.title.getSceneObject(), !pill || shiftPrivacy)
    show(this.recChip.so, pill)
    show(this.recChipText.getSceneObject(), pill)
    placeLabel(c.title, TITLE_X, CHIP_Y, shiftPrivacy ? SHIFT_SHORT_W : PATIENT_CHIP_X - TITLE_X - 0.1, CHIP_H)
    if (shiftPrivacy) setText(c.title, "Shift")
    if (pill) {
      placeBox(this.recChip, pillX, CHIP_Y, pillW, CHIP_H)
      placeLabel(this.recChipText, pillX, CHIP_Y, pillW, CHIP_H)
      setBorder(this.recChip.rr, {w: 0.08, c: pillInk})
      setText(this.recChipText, p.title, pillInk)
    } else setText(c.title, p.title)
    if (shiftPrivacy) this.setChip(c, "No patient", C.white, CHIP_W.noPatient, PRIVACY_PILL_X + PRIVACY_PILL_W + 0.3)
    else if (hidden) this.setChip(c, "Patient hidden", C.white, CHIP_W.notConfirmed)
    else this.setChip(c, p.initials + " verified", C.verified, CHIP_W.verified)
    setText(c.controls.privacy.labels[0], hidden ? "Privacy off" : "Privacy on")
    this.setControls(c, v.controls)
    this.patientBody.render(p)
  }

  // ---------------------------------------------------------------- s3-*

  /** Also called once a second while the drill clock runs. */
  renderEmergency(v: ScreenView): void {
    const e = v.emergency
    this.headLocked = e
    const bed = e !== null && e.surface === "bed"
    const travel = e !== null && e.surface === "travel"
    show(this.emergency.root, bed)
    show(this.cornerRoot, bed)
    show(this.travelRoot, travel)
    if (!e) return
    if (travel) {
      setShownPanel(null)
      this.travelCard.render(e)
      return
    }
    const c = this.emergency
    const h = EMERGENCY_CARD_Y + EmergencyCard.bedCardHeight(e) + EMERGENCY_END_GAP + BAR_H
    this.place(c, PATIENT_CENTRE_X - PANEL_W / 2, EMERGENCY_TOP, h, this.bedsideFrame, this.bedsideTurn)
    this.fit(c, h)
    this.setProgress(c, EMERGENCY_PROGRESS)
    setText(c.title, "Emergency")
    this.setChip(c, "Emergency · Bed 3", C.white, EMERGENCY_CHIP_W)
    this.setControls(c, v.controls)
    this.bedCard.render(e)
  }

  // ---------------------------------------------------------------- render

  /** `left` and `top` are about the view-frame centre, which `frame` puts in the ward. */
  private place(c: Chrome, left: number, top: number, h: number, frame: vec3 | null = null, turn: quat = quat.quatIdentity()): void {
    const o = frame ?? START_FRAME
    const r = frame ? turn : quat.quatIdentity()
    c.root.getTransform().setWorldPosition(o.add(r.multiplyVec3(new vec3(left, top, 0))))
    c.root.getTransform().setWorldRotation(r)
    // The flags' see-through test only handles panels square to the view.
    const square = Math.abs(r.w) > 0.9999
    setShownPanel(square ? {left: o.x + left, right: o.x + left + PANEL_W, top: o.y + top, bottom: o.y + top - h, z: o.z} : null)
  }

  render(v: ScreenView): void {
    const onShift = v.kind === "shift"
    const onWrist = v.kind === "wristband" && v.stage !== null
    show(this.shift.root, onShift)
    show(this.wrist.root, onWrist)
    const onPatient = v.kind === "patient" && v.patient !== null
    show(this.patient.root, onPatient)
    if (onPatient) this.renderPatient(v, v.patient as PatientView)
    const onEmergency = v.kind === "emergency" && v.emergency !== null
    if (!onShift && !onWrist && !onPatient && !onEmergency) setShownPanel(null)
    this.renderEmergency(v)
    if (onShift) this.renderShift(v)
    if (onWrist) this.renderWrist(v, v.stage as WristStage)
  }
}

function placeIcon(img: Image, x: number, y: number): void {
  const t = img.getSceneObject().getTransform()
  const z = t.getLocalPosition().z
  const s = t.getLocalScale().x
  t.setLocalPosition(new vec3(x + s / 2, -(y + s / 2), z))
}
