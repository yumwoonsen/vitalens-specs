import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/** A recording keeps running while the dashboard is minimised. The docked row has no REC mark: the top HUD shows it. */
@component
export class MinimiseRecScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await sleep(1600)
    main().round.presenterMode = true
    for (const b of ["BtnBed2", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob", "BtnNext", "BtnOpenNote", "BtnConsentGiven", "BtnStartCapture"]) await ui.tap(b)
    expect(main().getState().capture, "recording").toBe("recording")

    await ui.tap("BtnMinimise")
    await sleep(500)
    expect(main().getState().capture, "minimising keeps REC running").toBe("recording")
    expect(visible("MiniHudDockRec"), "no REC mark on the docked row").toBe(false)
    expect(canTap("BtnDockedNext"), "Next stays disabled while recording, as on the full dock").toBe(false)
    expect(canTap("BtnDockedCodeBlue"), "Code Blue reachable").toBe(true)
    await sleep(1500)
    expect(main().getState().capture, "still recording while minimised").toBe("recording")

    await ui.tap("BtnDockedRestore")
    expect(main().getState().capture, "REC survives restore").toBe("recording")
    expect(visible("PatientScreen"), "recording screen back").toBe(true)
    expect(canTap("BtnStopCapture"), "Stop note available again").toBe(true)
  }
}
