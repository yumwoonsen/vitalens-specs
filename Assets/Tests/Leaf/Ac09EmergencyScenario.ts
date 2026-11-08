import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, settle, snapshot, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC09 on the storyboard screens: the bottom-bar Code Blue button is always there, and the 5 s
 * auto-start stays off. The emergency view creates no clinical event, the drill clock is view-only, Call doctor is
 * simulated, and closing returns to the ward with unfinished work kept.
 */
@component
export class Ac09EmergencyScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await settle()
    main().round.presenterMode = false
    await ui.tap("BtnBed2")
    expect(canTap("BtnEmergency"), "Code Blue button with presenter mode off").toBe(true)

    main().round.presenterMode = true
    for (const b of ["BtnScanWristband", "BtnConfirmName", "BtnConfirmDob"]) await ui.tap(b)
    expect(canTap("BtnEmergency"), "Code Blue button in presenter mode").toBe(true)
    for (const b of ["BtnNext", "BtnOpenNote", "BtnConsentGiven", "BtnStartCapture", "BtnStopCapture"]) await ui.tap(b)
    const draft = main().getState().note

    await ui.tap("BtnEmergency")
    expect(main().getState().phase, "emergency mode").toBe("emergency")
    expect(main().getState().emergencyPatientId, "alert-linked patient").toBe("pt-target")
    expect(visible("EmergencyTravel") || visible("EmergencyScreen"), "emergency screen shown").toBe(true)
    expect(visible("Bed 3 Drill Outline"), "Bed 3 outlined during Code Blue").toBe(true)

    const atOpen = snapshot()
    const firstSecond = main().getDrillSecondShown()
    await sleep(2500)
    expect(main().getDrillSecondShown() > firstSecond, "the drill clock advances").toBe(true)
    expect(snapshot(), "waiting changes nothing in the store").toBe(atOpen)

    await ui.tap("BtnCallDoctor")
    expect(main().getState().emergencyContact, "simulated contact only").toBe(true)

    await ui.tap("BtnPresenterEmergency")
    const closed = main().getState()
    expect(closed.phase, "closing returns to the ward").toBe("clockIn")
    expect(closed.bedId, "no active patient").toBeNull()
    expect(closed.interruptedWork["pt-bed2"]?.note?.version, "unfinished draft kept").toBe(draft?.version)
    expect(visible("Bed 3 Drill Outline"), "outline only during Code Blue").toBe(false)

    // With presenter mode off, Next from the saved note is what starts Code Blue.
    await ui.tap("BtnPresenterReset")
    main().round.presenterMode = false
    for (const b of ["BtnBed2", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob", "BtnNext", "BtnOpenNote",
      "BtnConsentGiven", "BtnStartCapture", "BtnStopCapture", "BtnCorrectSite", "BtnSaveForReview"]) await ui.tap(b)
    expect(canTap("BtnEmergency"), "Code Blue button still there").toBe(true)
    expect(main().getState().phase === "emergency", "not started by saving").toBe(false)
    await ui.tap("BtnNext")
    expect(main().getState().phase, "Next starts Code Blue").toBe("emergency")
  }
}
