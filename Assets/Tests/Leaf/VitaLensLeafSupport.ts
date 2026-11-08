import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, findSceneObjectsByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PATIENTS} from "../../Scripts/Core/EncounterFixtures"
import {VitaLensMain} from "../../Scripts/VitaLensMain"

/**
 * Shared LEAF helpers for the VitaLens scenarios (plan Task 7). Every action goes
 * through a UI Kit button's Interactable, the way a nurse's pinch would. State is
 * read from the main script's read-only getState() and from the visible scene.
 */
export class VitaLensLeafInteractor extends DefaultLeafInteractor {
  /** Pinches an enabled button by its SceneObject name. Throws if it is missing or inactive. */
  async tap(name: string): Promise<void> {
    const target = findInteractablesByName(name, undefined, true)[0]
    if (!target) throw new Error(`Button "${name}" not found or not enabled`)
    await this.trigger(target)
    await sleep(250)
  }
}

/** True when an enabled Interactable with this name exists (an inactive button is not). */
export function canTap(name: string): boolean {
  return findInteractablesByName(name, undefined, true).length > 0
}

export function main(): VitaLensMain {
  const so = findSceneObjectByName("VitaLens Main")
  if (!so) throw new Error("VitaLens Main not found")
  return so.getComponent(VitaLensMain.getTypeName()) as VitaLensMain
}

export function visible(name: string): boolean {
  const so = findSceneObjectsByName(name).find(x=>x.isEnabledInHierarchy)
  return so !== undefined && so !== null && so.isEnabledInHierarchy
}

export function allVisible(name: string): boolean {
  const list = findSceneObjectsByName(name)
  return list.length > 0 && list.every((so) => so.isEnabledInHierarchy)
}

export function textOf(name: string): string {
  const so = findSceneObjectsByName(name).find(x=>x.isEnabledInHierarchy)
  if (!so) throw new Error(`Text object "${name}" not found`)
  const t = so.getComponent("Component.Text") as Text
  return t ? t.text : ""
}

/** Every string currently visible in Text components, scene-wide. */
export function visibleTexts(): string[] {
  const out: string[] = []
  const walk = (so: SceneObject) => {
    if (!so.isEnabledInHierarchy) return
    const texts = so.getComponents("Component.Text") as Text[]
    for (const t of texts) if (t.enabled && t.text.length > 0) out.push(t.text)
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) walk(global.scene.getRootObject(i))
  return out
}

/** Any fictional patient's full name, first name, surname or initials found in `s`. */
export function patientIdentifierIn(s: string): string | null {
  for (const p of Object.keys(PATIENTS)) {
    const fx = PATIENTS[p as keyof typeof PATIENTS]
    // Name words of 3 letters or more (titles and initials like "Mr", "K." and "Ah" are too short
    // to search for safely), the full name and the initials.
    const words = fx.fullName.split(" ").filter((w) => w.length >= 3 && w !== "Mdm")
    const parts = [fx.fullName, ...words, fx.initials]
    for (const part of parts) if (s.includes(part)) return part
  }
  return null
}

/** Live-service, record-system or validation claims (mirrors tests/core/labels-ward.test.ts). */
export function claimIn(s: string): string | null {
  if (/complian|validated|certified|regulator/i.test(s)) return "compliance or validation wording"
  if (/\blive\b/i.test(s.replace(/not live/gi, ""))) return "live-service wording"
  if (/was sent|has been sent|sent to/i.test(s)) return "sent wording"
  return null
}

export async function settle(): Promise<void> {
  await sleep(1500)
}

/** Boot → Clock in → Bed 2 (routine patient) → simulated scan → both identifiers confirmed (plan Task 8). */
export async function toVerifiedBed2(ui: VitaLensLeafInteractor): Promise<void> {
  await settle()
  for (const b of ["BtnBeginDemo", "BtnClockIn", "BtnBed2", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob"]) await ui.tap(b)
}

/** Verified Bed 2 → Routine round → consent → sample capture → draft → Review & filing. */
export async function toDraftInReview(ui: VitaLensLeafInteractor): Promise<void> {
  await toVerifiedBed2(ui)
  for (const b of ["BtnNext", "BtnConsentGiven", "BtnStartCapture", "BtnStopCapture", "BtnDraftNote", "BtnNext"]) await ui.tap(b)
}

/** Draft corrected and saved for COW review (v2), still in Review draft (plan Task 9). */
export async function toSavedInReview(ui: VitaLensLeafInteractor): Promise<void> {
  await toDraftInReview(ui)
  for (const b of ["BtnFlagSite", "BtnPickOption0", "BtnSaveForReview"]) await ui.tap(b)
}

/** Review draft → Emergency → Handover, the contract's phase order. */
export async function nextTwice(ui: VitaLensLeafInteractor): Promise<void> {
  await ui.tap("BtnNext")
  await ui.tap("BtnNext")
}

/** Stable JSON of the store, for "nothing changed" checks. */
export function snapshot(): string {
  return JSON.stringify(main().getState())
}

/**
 * Pinch-drags a UI Kit Slider's knob along the slider's own x axis for 600 ms.
 * LEAF's drag vector is applied on every drag update (frame), so `cmPerFrame`
 * 0.1 is a short partial slide and 2 runs to the end of the track.
 * Throws if the slider is missing or not enabled.
 */
export async function slide(ui: VitaLensLeafInteractor, name: string, cmPerFrame: number): Promise<void> {
  const target = findInteractablesByName(name, undefined, true)[0]
  if (!target) throw new Error(`Slider "${name}" not found or not enabled`)
  const right = target.sceneObject.getTransform().right
  await ui.drag(target, right.uniformScale(cmPerFrame), 600)
  await sleep(400)
}
