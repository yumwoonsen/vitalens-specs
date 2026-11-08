import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {claimIn, patientIdentifierIn, settle, textOf, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC11 (Boot to Identify part; owner round 2: one overall "Simulated" disclosure
 * on Boot plus a tag on each simulated capability where it is used). Bed flags
 * carry no names or initials, and no visible text claims a live service, a real
 * chart or validation.
 */
@component
export class Ac11LabelsScenario extends Scenario {
  private checkState(where: string): void {
    const claims = visibleTexts()
      .map((t) => claimIn(t))
      .filter((c) => c !== null)
    expect(claims.length, where + ": no live, sent or validation claims: " + claims.join(", ")).toBe(0)
  }

  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await settle()
    this.checkState("Boot")
    expect(textOf("BootDisclosure").startsWith("Simulated."), "Boot disclosure").toBe(true)

    await ui.tap("BtnBeginDemo")
    this.checkState("Clock in")
    await ui.tap("BtnClockIn")
    this.checkState("Shift overview")
    expect(textOf("BriefSession").includes("Not a real sign-in"), "demo session label").toBe(true)
    for (let n = 1; n <= 4; n++) {
      const flagText = textOf("BedFlag" + n + "Title") + " " + textOf("BedFlag" + n + "Needs")
      expect(patientIdentifierIn(flagText), "Bed " + n + " flag has no name or initials").toBeNull()
      expect(flagText.includes("Bed " + n), "Bed " + n + " flag names the bed").toBe(true)
    }

    await ui.tap("BtnBed2")
    this.checkState("Identify")
    const labels = visibleTexts().join(" | ")
    expect(labels.includes("Scan wristband (simulated)"), "scan is tagged simulated").toBe(true)
    expect(labels.includes("band (demo)"), "mismatch scan is tagged demo").toBe(true)
    expect(textOf("WristChipLine2"), "wristband chip tagged simulated").toBe("Wristband (simulated)")

    await ui.tap("BtnScanMismatch")
    this.checkState("Mismatch")
    await ui.tap("BtnRescan")
    await ui.tap("BtnScanWristband")
    await ui.tap("BtnConfirmName")
    await ui.tap("BtnConfirmDob")
    this.checkState("Verified")
  }
}
