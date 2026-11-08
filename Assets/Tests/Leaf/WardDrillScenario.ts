import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {main, settle, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/** Drives the current storyboard buttons, then starts the drill from the presenter control: it never starts itself. */
@component
export class WardDrillScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await settle()
    main().round.presenterMode = true
    expect(visible("Bed 3 Drill Outline"), "outline hidden before drill").toBe(false)
    for (const name of ["BtnBed2", "BtnScanWristband", "BtnConfirmName", "BtnConfirmDob", "BtnNext", "BtnNext",
      "BtnConsentGiven", "BtnStartCapture", "BtnStopCapture"]) await ui.tap(name)
    const before = main().getState()
    expect(before.note?.status, "draft visible before interruption").toBe("draft")
    expect(before.phase === "emergency", "drill has not started early").toBe(false)

    await sleep(5500)
    expect(main().getState().phase === "emergency", "no automatic start after the draft").toBe(false)
    await ui.tap("BtnPresenterEmergency")
    const during = main().getState()
    expect(during.phase, "presenter control starts emergency").toBe("emergency")
    expect(during.bedId, "routine bed selection clears").toBe(null)
    expect(visible("Bed 3 Drill Outline"), "destination outline stays active").toBe(true)
    const archived = before.scannedPatientId ? during.interruptedWork[before.scannedPatientId] : undefined
    expect(archived?.note?.status, "interruption preserves an unsubmitted draft").toBe("draft")
    expect(archived?.note?.version, "draft version preserved").toBe(before.note?.version)

    // Exercise accepted intents directly so overlay checks work from either camera posture.
    main().dispatch({type: "PRIVACY_ON"})
    await sleep(100)
    for (const part of ["Outline", "Marker", "Direction"]) {
      expect(visible(`Bed 3 Drill ${part}`), `privacy hides ${part.toLowerCase()}`).toBe(false)
    }
    main().dispatch({type: "PRIVACY_OFF"})
    await sleep(100)
    expect(visible("Bed 3 Drill Outline"), "restoring details returns the active outline").toBe(true)
    main().dispatch({type: "CLOSE_EMERGENCY"})
    await sleep(100)
    expect(main().getState().phase, "closing returns to the ward").toBe("clockIn")
    expect(visible("Bed 3 Drill Outline"), "closing retires the outline").toBe(false)
  }
}
