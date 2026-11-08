import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, textOf, toVerifiedBed2, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC03 (plan Task 8, owner round 2b compact HUD): the bed card shows the 6-line
 * record; sample capture needs consent and an explicit Start and Stop; declining
 * blocks capture; privacy and Minimise interrupt capture, and neither ending
 * privacy, expanding nor waiting restarts it.
 */
@component
export class Ac03CaptureScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toVerifiedBed2(ui)
    await ui.tap("BtnNext")
    expect(main().getState().phase, "Routine round").toBe("round")
    expect(visible("RoundCard"), "bed card shows the round").toBe(true)
    const record = textOf("RecordLines").split("\n")
    expect(record.length, "6 critical lines").toBe(6)
    expect(record[1], "medication line").toBe("09:30 · Paracetamol")
    expect(record[3], "mobility line").toBe("Mobility: assist ×1")
    expect(main().getState().consent, "consent not asked yet").toBe("unasked")
    expect(canTap("BtnStartCapture"), "Start capture locked before consent").toBe(false)

    // Consent declined blocks capture; Ask again returns to the question.
    await ui.tap("BtnConsentDeclined")
    expect(main().getState().consent, "declined").toBe("declined")
    expect(canTap("BtnStartCapture"), "no capture after decline").toBe(false)
    expect(textOf("CaptureStatus"), "decline message").toBe("Consent declined. Nothing is captured.")
    await ui.tap("BtnAskAgain")
    expect(main().getState().consent, "asked again").toBe("unasked")

    // Consent, then explicit start.
    await ui.tap("BtnConsentGiven")
    expect(main().getState().capture, "consent alone does not start capture").toBe("idle")
    await ui.tap("BtnStartCapture")
    expect(main().getState().capture, "recording after Start").toBe("recording")
    expect(visible("MiniHudRec"), "REC shown on the strip").toBe(true)
    expect(textOf("CaptureStatus").includes("no audio is recorded"), "sample disclosure while recording").toBe(true)

    // Privacy interrupts; ending privacy and waiting do not restart.
    await ui.tap("BtnPrivacy")
    let s = main().getState()
    expect(s.privacy, "privacy on").toBe(true)
    expect(s.capture, "privacy interrupts capture").toBe("interrupted")
    expect(visible("MiniHudRec"), "REC hidden").toBe(false)
    expect(visible("PrivacyPlate"), "privacy plate shown").toBe(true)
    expect(visible("RoundCard"), "patient card hidden").toBe(false)
    expect(textOf("MiniHudPatient"), "strip hides the patient").toBe("Patient hidden")
    await sleep(2000)
    await ui.tap("BtnPrivacy")
    await sleep(1500)
    s = main().getState()
    expect(s.privacy, "privacy off").toBe(false)
    expect(s.capture, "capture stays interrupted after privacy").toBe("interrupted")
    expect(s.transcript, "no transcript from an interrupted capture").toBe("none")
    expect(visible("MiniHudRec"), "REC stays off").toBe(false)

    // Minimise interrupts too; Expand does not restart.
    await ui.tap("BtnStartCapture")
    expect(main().getState().capture, "restarted only by Start").toBe("recording")
    await ui.tap("BtnMinimise")
    expect(main().getState().capture, "Minimise interrupts capture").toBe("interrupted")
    expect(visible("RoundCard"), "bed card hidden while minimised").toBe(false)
    expect(textOf("CaptureStatus").startsWith("Interrupted"), "capture status says interrupted").toBe(true)
    await ui.tap("BtnExpand")
    expect(main().getState().view.minimised, "card restored").toBe(false)
    expect(main().getState().capture, "Expand does not restart capture").toBe("interrupted")

    // Explicit start and stop give the sample transcript, then the labelled draft.
    await ui.tap("BtnStartCapture")
    await ui.tap("BtnStopCapture")
    s = main().getState()
    expect(s.capture, "stopped").toBe("stopped")
    expect(s.transcript, "sample transcript").toBe("sample")
    expect(textOf("RoundTitle"), "transcript labelled").toBe("Sample transcript")
    expect(textOf("RecordLines").includes("right knee"), "transcript text").toBe(true)
    await ui.tap("BtnDraftNote")
    expect(main().getState().note?.status, "draft created").toBe("draft")
    expect(textOf("CaptureStatus"), "points to review").toBe("Draft v1 ready. Next: review the draft.")
  }
}
