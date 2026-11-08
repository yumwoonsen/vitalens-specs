import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {createInitialState} from "../../Scripts/Core/EncounterReducer"
import {allVisible, main, patientIdentifierIn, settle, textOf, visible, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC01 (reset part, plan Task 7): after a verified Bed 2 identification, Menu →
 * Reset demo → Confirm returns every value to the start, shows Boot with the
 * disclosure, shows no patient content, and the walkthrough starts again.
 */
@component
export class Ac01ResetScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await settle()
    expect(main().getState().phase, "starts at Boot").toBe("boot")
    expect(visible("BootWindow"), "Boot disclosure shown").toBe(true)

    await ui.tap("BtnBeginDemo")
    await ui.tap("BtnClockIn")
    expect(allVisible("BedFlag"), "every bed flag shown after Clock in").toBe(true)
    await ui.tap("BtnBed2")
    await ui.tap("BtnScanWristband")
    await ui.tap("BtnConfirmName")
    await ui.tap("BtnConfirmDob")
    expect(main().getState().verification, "verified before reset").toBe("verified")
    expect(textOf("WristChipLine1").includes("Mr Ahmad Hakim"), "chip names the patient before reset").toBe(true)

    await ui.tap("BtnMenu")
    expect(visible("MenuMain"), "menu open").toBe(true)
    await ui.tap("BtnMenuReset")
    expect(visible("MenuConfirm"), "reset asks for confirmation").toBe(true)
    expect(main().getState().phase, "nothing reset before Confirm").toBe("identify")
    await ui.tap("BtnMenuConfirm")

    expect(JSON.stringify(main().getState()), "state equals the initial state").toBe(JSON.stringify(createInitialState()))
    expect(visible("BootWindow"), "Boot disclosure shown again").toBe(true)
    expect(visible("IdentityGate"), "identity gate hidden").toBe(false)
    expect(visible("WristChip"), "wristband chip hidden").toBe(false)
    expect(visible("BriefWindow"), "shift brief hidden").toBe(false)
    expect(visible("MenuMain") || visible("MenuConfirm"), "menu closed").toBe(false)
    expect(textOf("MiniHudPatient"), "strip reads No patient").toBe("No patient")
    const leaked = visibleTexts()
      .map((t) => patientIdentifierIn(t))
      .filter((p) => p !== null)
    expect(leaked.length, "no patient name or initials visible after reset: " + leaked.join(", ")).toBe(0)

    await ui.tap("BtnBeginDemo")
    await ui.tap("BtnClockIn")
    expect(main().getState().phase, "walkthrough starts again at Clock in").toBe("clockIn")
    expect(visible("BriefWindow"), "shift brief shown again").toBe(true)
    expect(main().getState().bedId, "no bed carried over").toBeNull()
  }
}
