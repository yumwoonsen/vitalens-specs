import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, patientIdentifierIn, textOf, visible, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/** Fails on the first visible text that names a patient, or shows a stats ring, the patient list or a bed's need. */
function expectNothingIdentifying(where: string): void {
  for (const t of visibleTexts()) {
    expect(patientIdentifierIn(t), `${where}: no patient identifier in "${t}"`).toBe(null)
    expect(/Assigned|Obs due|Meds due|Bed \d,/.test(t), `${where}: no patient list, counts or bed need in "${t}"`).toBe(false)
  }
}

/**
 * Privacy mode, storyboard "Privacy on" (storyboard-redesign.html, privacy branch), on the shift
 * overview, the Bed 2 wristband check and a Bed 2 recording. Ends with privacy on at Bed 2 for a capture.
 */
@component
export class PrivacyModeScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await sleep(1600)

    // Shift overview: the compact panel, no list, no names, no rings.
    await ui.tap("BtnPrivacy")
    expect(main().getState().privacy, "privacy on").toBe(true)
    expect(visible("ShiftScreen"), "shift overview hidden").toBe(false)
    expect(visible("PatientScreen"), "privacy panel shown").toBe(true)
    expect(textOf("PrivacyText"), "compact wording").toBe("Privacy on. Patient information hidden. Capture stopped.")
    expect(visible("PrivacySource"), "Simulated tag on the compact panel").toBe(true)
    expect(textOf("MiniHudNextCompact"), "strip need").toBe("Ward details hidden")
    expect(textOf("MiniHudPatientCompact"), "strip patient").toBe("No patient")
    expectNothingIdentifying("shift")
    await ui.tap("BtnPrivacy")
    expect(main().getState().privacy, "privacy off").toBe(false)
    expect(visible("ShiftScreen"), "Privacy off restores the shift overview").toBe(true)

    // Bed 2 wristband check, before the patient is verified.
    for (const b of ["BtnBed2", "BtnScanWristband"]) await ui.tap(b)
    await ui.tap("BtnPrivacy")
    expect(visible("WristbandScreen"), "wristband screen hidden").toBe(false)
    expect(textOf("PrivacyText"), "full wording at the bedside").toBe("Patient information hidden. Capture stopped.")
    expect(visible("PrivacySource"), "no Simulated tag on the full panel").toBe(false)
    expect(textOf("MiniHudPatientCompact"), "strip patient").toBe("Patient hidden")
    expectNothingIdentifying("Bed 2 wristband")
    await ui.tap("BtnPrivacy")
    expect(visible("WristbandScreen"), "Privacy off restores the wristband check").toBe(true)
    expect(canTap("BtnConfirmName"), "at the same step").toBe(true)

    // A recording: privacy stops it, and Privacy off does not restart it.
    for (const b of ["BtnConfirmName", "BtnConfirmDob", "BtnNext", "BtnOpenNote", "BtnConsentGiven", "BtnStartCapture"]) await ui.tap(b)
    expect(main().getState().capture, "recording").toBe("recording")
    await ui.tap("BtnPrivacy")
    expect(main().getState().capture === "recording", "privacy stops capture").toBe(false)
    expectNothingIdentifying("Bed 2 recording")
    await sleep(1000)
    await ui.tap("BtnPrivacy")
    expect(main().getState().capture === "recording", "capture does not restart").toBe(false)
    expect(visible("PatientScreen"), "the note screen is back").toBe(true)

    // End on privacy for the capture.
    await ui.tap("BtnPrivacy")
    expect(main().getState().privacy, "privacy on at the end").toBe(true)
  }
}
