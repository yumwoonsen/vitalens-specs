import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {PATIENTS} from "../../Scripts/Core/EncounterFixtures"
import {canTap, main, nextTwice, slide, textOf, toSavedInReview, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC06 (plan Task 9): Switch patient, confirmed from the menu, clears the encounter
 * after a saved draft and an approved handover. Nothing from the old patient is shown,
 * and the next patient starts unconfirmed.
 */
@component
export class Ac06SwitchScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toSavedInReview(ui)
    await nextTwice(ui)
    await ui.tap("BtnBuildHandover")
    await slide(ui, "SliderApproveHandover", 2)
    expect(main().getState().handover?.status, "handover approved before the switch").toBe("approved")

    await ui.tap("BtnMenu")
    await ui.tap("BtnMenuSwitch")
    expect(textOf("MenuClears").includes("Note drafts and approvals"), "the menu lists what is cleared").toBe(true)
    expect(main().getState().note?.status, "nothing cleared before Confirm").toBe("pendingReview")
    await ui.tap("BtnMenuConfirm")

    const s = main().getState()
    expect(s.phase, "back to the shift brief").toBe("clockIn")
    expect(s.session, "the nurse stays clocked in").toBe("demo")
    expect(s.bedId, "no bed").toBe(null)
    expect(s.verification, "identification cleared").toBe("idle")
    expect(s.scannedPatientId, "scan cleared").toBe(null)
    expect(s.consent, "consent cleared").toBe("unasked")
    expect(s.capture, "capture cleared").toBe("idle")
    expect(s.transcript, "transcript cleared").toBe("none")
    expect(s.note, "draft cleared").toBe(null)
    expect(s.noteHistory.length, "history cleared").toBe(0)
    expect(s.handover, "handover cleared").toBe(null)
    expect(textOf("MiniHudLine1"), "strip shows no patient").toBe("No patient")
    const name = PATIENTS["pt-target"].fullName
    const shown = visibleTexts().filter((t) => t.includes(name))
    expect(shown.length, "old patient's name not shown: " + shown.join(" | ")).toBe(0)
    expect(canTap("BtnSaveForReview"), "no draft action").toBe(false)
    expect(canTap("BtnBuildHandover"), "no handover action").toBe(false)

    await ui.tap("BtnBed3")
    const again = main().getState()
    expect(again.phase, "Identify").toBe("identify")
    expect(again.verification, "the patient must be confirmed again").toBe("idle")
    expect(canTap("BtnConfirmName"), "no confirmation before a scan").toBe(false)
  }
}
