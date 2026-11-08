import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {canTap, main, settle, textOf, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC02 on the storyboard screens: a mismatched or unconfirmed patient blocks encounter
 * actions, Next stays disabled until verified, and a rescan plus both identifiers recovers.
 * The wrong band comes from the presenter control, as the wristband screen has no such button.
 */
@component
export class Ac02IdentifyScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await settle()
    main().round.presenterMode = true
    await ui.tap("BtnBed2")
    expect(visible("WristbandScreen"), "wristband check shown for Bed 2").toBe(true)
    expect(main().getState().verification, "choosing a bed does not verify").toBe("idle")
    expect(canTap("BtnConfirmName"), "confirm locked before a scan").toBe(false)
    expect(canTap("BtnNext"), "Next disabled before verification").toBe(false)
    expect(visible("EmergencyBedMarker") || visible("EmergencyBedArrow"), "the scan pointer shows at the scan step").toBe(true)

    // Mismatched wristband.
    await ui.tap("BtnPresenterMismatch")
    expect(main().getState().verification, "mismatch detected").toBe("mismatch")
    expect(textOf("WristChipLine1"), "wristband chip").toBe("Mismatch")
    expect(canTap("BtnConfirmName") || canTap("BtnConfirmDob"), "identifiers cannot be confirmed").toBe(false)
    expect(canTap("BtnNext"), "Next does not bypass the mismatch").toBe(false)
    expect(visible("PatientScreen"), "no patient record").toBe(false)

    // Recovery: rescan and confirm both identifiers, one at a time.
    await ui.tap("BtnRescan")
    await ui.tap("BtnScanWristband")
    expect(main().getState().verification, "matching scan").toBe("scanned")
    expect(visible("EmergencyBedMarker") || visible("EmergencyBedArrow"), "the pointer goes once the scan is done").toBe(false)
    await ui.tap("BtnConfirmName")
    expect(main().getState().verification, "one identifier is not enough").toBe("scanned")
    expect(canTap("BtnNext"), "Next still disabled").toBe(false)
    await ui.tap("BtnConfirmDob")
    expect(main().getState().verification, "verified with 2 identifiers").toBe("verified")
    expect(visible("WristbandScreen"), "verified screen holds until Next").toBe(true)
    await ui.tap("BtnNext")
    expect(visible("PatientScreen"), "encounter unlocks after verification").toBe(true)
  }
}
