// VitalLens shared UI parts (plan Task 7). Owns the HUD tokens from
// .kiro/specs/vitalens-walkthrough/design.md §3 (colour, type, sizes) and the
// UI Kit composition helpers every *UI.ts module uses (specs-build-ui:
// obj / flex / flexChild / BackPlate panel / Button with a raw Text label).
// It holds no state and makes no decisions. Only UI modules import it.
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import type {Tone} from "./Core/EncounterSelectors"

const FONT_REGULAR = requireAsset("../Fonts/AtkinsonHyperlegibleNext_400Regular.ttf") as Font
const FONT_SEMIBOLD = requireAsset("../Fonts/AtkinsonHyperlegibleNext_600SemiBold.ttf") as Font

// ------------------------------------------------------------------ scale

/** The one size control for the one-panel screens. 0.8 is 32 cm (kiro/proposal) against the spec's 40 cm. */
export const UI_SCALE = 0.8
/** A spec measurement in cm at the current scale: widths, padding, gaps, icons, rings. */
export function cm(specCm: number): number {
  return specCm * UI_SCALE
}
/** A touch-target size: scaled, but never below the 4 cm minimum. */
export function targetCm(specCm: number): number {
  return Math.max(4, cm(specCm))
}
/** Text scales only down to the primary floor; 1.6 cm and smaller keep their size. */
export function fontCm(specCm: number): number {
  return specCm <= 1.6 ? specCm : Math.max(1.6, cm(specCm))
}

/** The big plate behind each screen. Change this one line to try other values. Inner cards and text keep the spec's colours. */
export const PANEL_PLATE = hex("#141A20", 0.96)

/** Text weight comes from the font file: 600 and above use SemiBold, the rest Regular. */
export function setWeight(t: Text, weight: number): void {
  t.font = weight >= 600 ? FONT_SEMIBOLD : FONT_REGULAR
}

// ------------------------------------------------------------------ what the viewer sees

/** World rectangle of the panel on show, on a plane facing the viewer. */
export interface PanelRect {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly z: number
}

let shownPanel: PanelRect | null = null
let viewer: vec3 | null = null

export function setShownPanel(rect: PanelRect | null): void {
  shownPanel = rect
}

export function setViewerPosition(position: vec3): void {
  viewer = position
}

/** True when a w × h plane at `centre` is seen through the shown panel. */
export function isBehindShownPanel(centre: vec3, w: number, h: number): boolean {
  if (!shownPanel || !viewer) return false
  const depth = centre.z - viewer.z
  if (depth === 0) return false
  const t = (shownPanel.z - viewer.z) / depth
  if (t <= 0 || t >= 1) return false
  const x = viewer.x + (centre.x - viewer.x) * t
  const y = viewer.y + (centre.y - viewer.y) * t
  const hw = (w / 2) * t
  const hh = (h / 2) * t
  return x + hw > shownPanel.left && x - hw < shownPanel.right && y + hh > shownPanel.bottom && y - hh < shownPanel.top
}

/**
 * The one bed-anchored card (owner round 2b): 30 cm wide at about 1 m, one card
 * at a time, top edge at v = 18 in the card root. Inner width after padding.
 */
export const CARD = {w: 30, inner: 27.6, top: 18} as const
/** Card button height: above the 4 cm minimum target at about 1 m. */
export const CARD_BTN_H = 5
const IMAGE_MATERIAL = requireAsset("../Materials/VitaLensImage.mat") as Material

// ------------------------------------------------------------------ colour (design §3.1)

export function hex(h: string, a: number = 1): vec4 {
  const n = parseInt(h.slice(1), 16)
  return new vec4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a)
}

export const COLOR = {
  core: hex("#5EEAD4"),
  ink: hex("#F8FAFC"),
  inkSoft: hex("#C9D1D8"),
  verified: hex("#6EE7B7"),
  caution: hex("#FCD34D"),
  emergency: hex("#FCA5A5"),
  emergencyInk: hex("#FCA5A5"),
  system: hex("#7DD3FC"),
  disabled: hex("#CCFBF1", 0.45),
}

/** Text colour for a selector tone. Colour always travels with a word or icon. */
export function toneColor(tone: Tone, neutral: vec4 = COLOR.ink): vec4 {
  switch (tone) {
    case "caution":
      return COLOR.caution
    case "verified":
      return COLOR.verified
    case "emergency":
      return COLOR.emergency
    case "system":
      return COLOR.system
    default:
      return neutral
  }
}

// ------------------------------------------------------------------ type (design §3.2)

/** Em height in cm at the console (107–113 cm). Text.size = em cm × 43.886. */
export type TextRole = "Figure" | "Title" | "Body" | "Label"
const EM_CM: {readonly [K in TextRole]: number} = {Figure: 2.4, Title: 1.8, Body: 1.3, Label: 1.0}
const WEIGHT: {readonly [K in TextRole]: number} = {Figure: 600, Title: 600, Body: 400, Label: 500}
/** Correction for the theme font's em fill (1.0 = sizes as specified). */
const FONT_SIZE_SCALE = 1.0

export function applyTextRole(t: Text, role: TextRole, scale: number = 1): void {
  t.size = EM_CM[role] * 43.886 * scale * FONT_SIZE_SCALE
  setWeight(t, WEIGHT[role])
}

// ------------------------------------------------------------------ layout helpers (specs-build-ui helpers.md)

const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08

export function obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (position) so.getTransform().setLocalPosition(position)
  return so
}

export interface FlexOpts {
  gap?: number
  padX?: number
  padY?: number
  justify?: FlexJustify
  align?: FlexAlign
}

function makeFlex(container: SceneObject, direction: FlexDirection, w: number, h: number, o: FlexOpts): void {
  const flex = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
  // Children are registered with addItems as they are built (before init), which
  // UI Kit only allows with auto-discovery off.
  flex.autoDiscoverItemsOnStart = false
  flex.onInitialized.add(() => {
    flex.width = w
    flex.height = h
    flex.direction = direction
    if (direction === FlexDirection.Row) flex.columnGap = o.gap ?? 0
    else flex.rowGap = o.gap ?? 0
    flex.paddingTop = o.padY ?? 0
    flex.paddingBottom = o.padY ?? 0
    flex.paddingLeft = o.padX ?? 0
    flex.paddingRight = o.padX ?? 0
    flex.justifyContent = o.justify ?? FlexJustify.Start
    flex.alignItems = o.align ?? FlexAlign.Stretch
  })
}

/** A bed-card window of height h, top-aligned with every other card (one shows at a time). */
export function cardPanel(parent: SceneObject, name: string, h: number, o: FlexOpts = {}): Panel {
  return panel(parent, name, CARD.w, h, new vec3(0, CARD.top - h / 2, 0), o)
}

/** Adds a sized child to the parent's FlexLayout and registers it (addItems is mandatory). */
export function flexChild(parent: SceneObject, w: number, h: number, builder?: (child: SceneObject) => void): SceneObject {
  const child = obj(parent, "Item", new vec3(0, 0, LAYOUT_Z_LIFT))
  const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = w
  item.overrideHeight = h
  item.flexGrow = 0
  item.flexShrink = 0
  if (builder) builder(child)
  const parentFlex = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (parentFlex) parentFlex.addItems([item])
  return child
}

export function flexRow(parent: SceneObject, w: number, h: number, o: FlexOpts = {}): SceneObject {
  const row = flexChild(parent, w, h)
  makeFlex(row, FlexDirection.Row, w, h, {align: FlexAlign.Center, ...o})
  return row
}

export function flexColumn(parent: SceneObject, w: number, h: number, o: FlexOpts = {}): SceneObject {
  const col = flexChild(parent, w, h)
  makeFlex(col, FlexDirection.Column, w, h, o)
  return col
}

export interface Panel {
  readonly root: SceneObject
  /** Column FlexLayout that holds the panel's rows. */
  readonly column: SceneObject
}

/** A static window: BackPlate first, then a Content column 0.6 cm in front (z-fighting rule). */
export function panel(parent: SceneObject, name: string, w: number, h: number, position: vec3, o: FlexOpts = {}): Panel {
  const root = obj(parent, name, position)
  const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
  plate.size = new vec2(w, h)
  const column = obj(root, "Content", new vec3(0, 0, 0.6))
  makeFlex(column, FlexDirection.Column, w, h, {gap: o.gap ?? 1, padX: o.padX ?? 1.2, padY: o.padY ?? 1.2, justify: o.justify, align: o.align})
  return {root, column}
}

export interface TextOpts {
  color?: vec4
  align?: "left" | "center" | "right"
  /** Text object name, so tests can read it. */
  name?: string
}

/** Wrapping raw Text sized by its layout cell (column-direction parent). */
export function text(parent: SceneObject, value: string, role: TextRole, w: number, h: number, o: TextOpts = {}): Text {
  const cell = flexChild(parent, w, h)
  if (o.name) cell.name = o.name
  return makeText(cell, value, role, w, h, o)
}

export function makeText(host: SceneObject, value: string, role: TextRole, w: number, h: number, o: TextOpts = {}): Text {
  const t = host.createComponent("Component.Text") as Text
  t.text = value
  t.depthTest = true
  applyTextRole(t, role)
  t.horizontalAlignment =
    o.align === "center" ? HorizontalAlignment.Center : o.align === "right" ? HorizontalAlignment.Right : HorizontalAlignment.Left
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  t.textFill.color = o.color ?? COLOR.ink
  return t
}

export function image(host: SceneObject, texture: Texture, sizeCm: number, position: vec3): Image {
  const so = obj(host, "Icon", position)
  const img = so.createComponent("Component.Image") as Image
  const mat = IMAGE_MATERIAL.clone()
  mat.mainPass.baseTex = texture
  mat.mainPass.depthTest = true
  mat.mainPass.depthWrite = false
  img.clearMaterials()
  img.addMaterial(mat)
  so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
  return img
}

export interface UiButton {
  readonly button: Button
  readonly label: Text | null
}

export interface ButtonOpts {
  style?: "PrimaryNeutral" | "Primary" | "Secondary"
  round?: boolean
  icon?: Texture
  role?: TextRole
}

/**
 * UI Kit Button (SnapOS2 Rectangle or Round) with a width-budgeted raw Text label
 * lifted in front of the face. The button SceneObject carries `name`, which is
 * the Interactable name LEAF scenarios look up.
 */
export function button(parent: SceneObject, name: string, label: string, w: number, h: number, onTap: () => void, o: ButtonOpts = {}): UiButton {
  const cell = flexChild(parent, w, h)
  const so = obj(cell, name)
  const btn = so.createComponent(Button.getTypeName()) as Button
  btn.setVariant({theme: "SnapOS2", shape: o.round ? "Round" : "Rectangle", style: o.style ?? "PrimaryNeutral"})
  btn.size = new vec3(w, h, 1)
  let t: Text | null = null
  if (o.icon) image(so, o.icon, Math.min(2.4, h * 0.45), new vec3(label ? -w / 2 + 2 : 0, 0, BUTTON_LABEL_Z))
  if (label) {
    const lw = o.icon ? w - 3.5 : w - 0.8
    const host = obj(so, "ButtonLabel", new vec3(o.icon ? 1.3 : 0, 0, BUTTON_LABEL_Z))
    t = makeText(host, label, o.role ?? "Label", lw, h - 0.6, {align: "center"})
  }
  btn.onTriggerUp.add(() => onTap())
  return {button: btn, label: t}
}

/** A slide counts as complete only at the far end of the track. */
const SLIDE_COMPLETE_AT = 0.95

/**
 * "Slide to sign" control: a UI Kit Slider (size set before initialize, the
 * Slider/Switch exception in specs-build-ui). It calls onComplete only when the
 * user releases the knob at the end of the track. A partial slide emits nothing
 * and the knob returns to the start. Code never moves it to the end, so no timer can complete it.
 */
export function approvalSlider(parent: SceneObject, name: string, w: number, h: number, onComplete: () => void): Slider {
  const cell = flexChild(parent, w, h)
  const so = obj(cell, name)
  const s = so.createComponent(Slider.getTypeName()) as Slider
  ;(s as any)._size = new vec3(w, h, 1)
  s.initialize()
  s.currentValue = 0
  // UI Kit 2.0 Slider commits its value (onValueChange) when the drag ends; tapping
  // does not move it (snapToTriggerPosition is off). Code only ever sets it back to 0.
  s.onValueChange.add((value: number) => {
    if (value === 0) return
    s.currentValue = 0
    if (value < SLIDE_COMPLETE_AT) return
    if (!s.inactive) onComplete()
  })
  return s
}

/** Enabled controls take input; disabled ones go inactive and dim their label. */
export function setControl(b: UiButton, enabled: boolean): void {
  setInactive(b.button, !enabled)
  if (b.label) b.label.textFill.color = enabled ? COLOR.ink : COLOR.disabled
}

/**
 * UI Kit 2.0 Elements re-enable their Interactable and collider on OnEnableEvent
 * (a window being shown), and the inactive setter ignores an unchanged value, so
 * the state is re-applied on every render.
 */
export function setInactive(el: {inactive: boolean}, inactive: boolean): void {
  if (el.inactive === inactive) el.inactive = !inactive
  el.inactive = inactive
}

export function setText(t: Text, value: string, color?: vec4): void {
  if (t.text !== value) t.text = value
  if (color) t.textFill.color = color
}

export function show(so: SceneObject, visible: boolean): void {
  if (so.enabled !== visible) so.enabled = visible
}

// ------------------------------------------------------------------ absolute parts (storyboard spec)
// Coordinates are cm from the parent's top-left corner, y down, as in lens-spec.json.

const ORDER_FILL = 10
const ORDER_RAISED = 11
const ORDER_CONTENT = 12
const Z_FILL = 0.62
const Z_RAISED = 0.66
const Z_CONTENT = 0.72

export interface Border {
  readonly w: number
  readonly c: vec4
}

export interface Box {
  readonly so: SceneObject
  readonly rr: RoundedRectangle
}

/** A flat rounded rectangle with an exact colour. `raised` draws it above ordinary fills. */
export function box(parent: SceneObject, x: number, y: number, w: number, h: number, color: vec4, radius: number = 0, border?: Border, raised: boolean = false): Box {
  const so = obj(parent, "Box", new vec3(x + w / 2, -(y + h / 2), raised ? Z_RAISED : Z_FILL))
  const rr = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rr.size = new vec2(w, h)
  rr.cornerRadius = Math.min(radius, w / 2, h / 2)
  rr.initialize()
  rr.renderMeshVisual.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto
  // Same mask as BackPlate.
  rr.renderMeshVisual.mainPass.colorMask = new vec4b(true, true, true, true)
  rr.gradient = false
  rr.backgroundColor = color
  rr.renderOrder = raised ? ORDER_RAISED : ORDER_FILL
  if (border) setBorder(rr, border)
  return {so, rr}
}

export function setBorder(rr: RoundedRectangle, b: Border | null): void {
  rr.border = b !== null
  if (!b) return
  rr.borderSize = b.w
  rr.borderColor = b.c
}

export function placeBox(b: Box, x: number, y: number, w: number, h: number): void {
  const z = b.so.getTransform().getLocalPosition().z
  b.so.getTransform().setLocalPosition(new vec3(x + w / 2, -(y + h / 2), z))
  b.rr.size = new vec2(w, h)
}

export interface LabelOpts {
  align?: "left" | "center" | "right"
  name?: string
  /** Wrap onto more lines. Otherwise a line that does not fit is cut, never shrunk. */
  wrap?: boolean
}

/** One Text with an exact size (em cm), weight and colour. */
export function label(parent: SceneObject, x: number, y: number, w: number, h: number, value: string, fs: number, weight: number, color: vec4, o: LabelOpts = {}): Text {
  const host = obj(parent, o.name ?? "Label", new vec3(x + w / 2, -(y + h / 2), Z_CONTENT))
  const t = makeText(host, value, "Label", w, h, {color, align: o.align})
  applyTextRole(t, "Label", fs)
  setWeight(t, weight)
  t.horizontalOverflow = o.wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Truncate
  t.setRenderOrder(ORDER_CONTENT)
  return t
}

export function placeLabel(t: Text, x: number, y: number, w: number, h: number): void {
  t.getSceneObject().getTransform().setLocalPosition(new vec3(x + w / 2, -(y + h / 2), Z_CONTENT))
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
}

/** A tinted icon whose top-left corner is at (x, y). */
export function icon(parent: SceneObject, texture: Texture, x: number, y: number, sizeCm: number, color: vec4): Image {
  const img = image(parent, texture, sizeCm, new vec3(x + sizeCm / 2, -(y + sizeCm / 2), Z_CONTENT))
  img.mainPass.baseColor = color
  img.setRenderOrder(ORDER_CONTENT)
  return img
}

export interface SolidButton {
  readonly button: Button
  /** Top-left corner of the button: parent for its label and icon. */
  readonly face: SceneObject
  readonly cell: SceneObject
  readonly fill: Box
  readonly w: number
  readonly h: number
  labels: Text[]
  icons: Image[]
  base: vec4
  enabled: boolean
}

const HOVER_LIFT = 0.07
const DISABLED_ALPHA = 0.55

/**
 * A UI Kit Button for targeting and events, drawn with an exact solid fill: its own
 * visual is switched off because it would replace the colour with its theme's. The
 * object carries `name`, which LEAF scenarios look up. Hover changes colour at once.
 */
export function solidButton(parent: SceneObject, name: string, x: number, y: number, w: number, h: number, fillColor: vec4, radius: number, onTap: () => void, border?: Border, hitH: number = h): SolidButton {
  const cell = obj(parent, name + "Cell", new vec3(x, -y, 0))
  const fill = box(cell, 0, 0, w, h, fillColor, radius, border)
  const so = obj(cell, name, new vec3(w / 2, -h / 2, Z_RAISED))
  const b = so.createComponent(Button.getTypeName()) as Button
  b.setVariant({theme: "SnapOS2", shape: "Rectangle", style: "PrimaryNeutral"})
  b.size = new vec3(w, hitH, 1)
  const out: SolidButton = {button: b, face: cell, cell, fill, w, h, labels: [], icons: [], base: fillColor, enabled: true}
  b.onInitialized.add(() => hideButtonVisual(out))
  // UI Kit switches its themed visual back on after a hover or tap, which ghosts over the fill.
  b.createEvent("LateUpdateEvent").bind(() => hideButtonVisual(out))
  b.onHoverEnter.add(() => {
    const c = out.base
    fill.rr.backgroundColor = new vec4(c.x + HOVER_LIFT, c.y + HOVER_LIFT, c.z + HOVER_LIFT, Math.min(1, c.w + HOVER_LIFT))
  })
  b.onHoverExit.add(() => {
    fill.rr.backgroundColor = out.base
  })
  b.onTriggerUp.add(() => onTap())
  return out
}

function hideButtonVisual(b: SolidButton): void {
  const rmv = b.button.sceneObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null
  if (rmv && rmv.enabled) rmv.enabled = false
}

export function setSolidFill(b: SolidButton, color: vec4): void {
  b.base = color
  b.fill.rr.backgroundColor = color
}

/** Disabled: takes no input and dims to the storyboard's 0.55 opacity. */
export function setSolidEnabled(b: SolidButton, enabled: boolean): void {
  setInactive(b.button, !enabled)
  hideButtonVisual(b)
  b.enabled = enabled
  const a = enabled ? 1 : DISABLED_ALPHA
  for (const t of b.labels) {
    const c = t.textFill.color
    t.textFill.color = new vec4(c.x, c.y, c.z, a)
  }
  for (const i of b.icons) {
    const c = i.mainPass.baseColor
    i.mainPass.baseColor = new vec4(c.x, c.y, c.z, a)
  }
  b.fill.rr.backgroundColor = new vec4(b.base.x, b.base.y, b.base.z, b.base.w * a)
}
