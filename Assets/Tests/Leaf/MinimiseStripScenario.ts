import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, textOf, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/** Minimise docks the five dock buttons under the top HUD; Back and Next work from the row; Restore returns the same screen. */
@component
export class MinimiseStripScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await sleep(1600)
    main().round.presenterMode = true
    for (const b of ["BtnBed2", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob", "BtnNext"]) await ui.tap(b)
    expect(visible("PatientScreen"), "patient overview before minimising").toBe(true)
    expect(textOf("MiniHudModeCompact").startsWith("Overview"), "step on the top HUD").toBe(true)

    await ui.tap("BtnMinimise")
    await sleep(500)
    expect(main().getState().view.minimised, "minimised").toBe(true)
    expect(visible("PatientScreen"), "dashboard collapsed").toBe(false)
    for (const b of ["BtnDockedBack", "BtnDockedPrivacy", "BtnDockedRestore", "BtnDockedCodeBlue", "BtnDockedNext"]) {
      expect(visible(b), b + " in the docked row").toBe(true)
    }
    expect(visible("MiniHudDockWho"), "no details strip").toBe(false)
    expect(canTap("BtnDockedNext"), "Next enabled on the overview, as in the full dock").toBe(true)

    // Next from the row does what Next does on the full dock: opens the note, and the step changes.
    await ui.tap("BtnDockedNext")
    expect(main().getState().bodyView, "Next opened the note").toBe("note")
    expect(main().getState().view.minimised, "still minimised").toBe(true)
    expect(textOf("MiniHudModeCompact").startsWith("Note"), "step changed on the top HUD").toBe(true)
    await ui.tap("BtnDockedBack")
    expect(main().getState().bodyView, "Back returned to the overview").toBe("overview")
    expect(textOf("MiniHudModeCompact").startsWith("Overview"), "step back to Overview").toBe(true)
    await ui.tap("BtnDockedNext")

    await ui.tap("BtnDockedRestore")
    expect(main().getState().view.minimised, "restored").toBe(false)
    expect(visible("PatientScreen"), "dashboard back").toBe(true)
    expect(main().getState().bodyView, "same screen as before restoring").toBe("note")
    expect(visible("BtnDockedRestore"), "row gone after restore").toBe(false)

    await ui.tap("BtnMinimise")
    await sleep(500)
    await ui.tap("BtnDockedCodeBlue")
    expect(main().getState().phase, "Code Blue from the row").toBe("emergency")
    expect(main().getState().view.minimised, "Code Blue shows the full view").toBe(false)
  }
}
