import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {main, patientIdentifierIn, textOf, visible, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/** Privacy at a second bed (Bed 3, verified, patient overview). Ends with privacy on for a capture. */
@component
export class PrivacyBed3Scenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await sleep(1600)
    for (const b of ["BtnBed3", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob", "BtnNext"]) await ui.tap(b)
    await ui.tap("BtnPrivacy")
    expect(main().getState().privacy, "privacy on").toBe(true)
    expect(visible("PatientScreen"), "privacy panel shown").toBe(true)
    expect(textOf("PrivacyText"), "full wording at the bedside").toBe("Patient information hidden. Capture stopped.")
    expect(textOf("MiniHudPatientCompact"), "strip patient").toBe("Patient hidden")
    for (const t of visibleTexts()) expect(patientIdentifierIn(t), `no patient identifier in "${t}"`).toBe(null)
  }
}
