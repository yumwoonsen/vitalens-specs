import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, textOf, toDraftInReview, visible, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC04 (plan Task 8, reworded by owner round 2): the simulated draft can be
 * inspected, rejected and corrected from the pick list. Next, Back and waiting never
 * change its status; only "Save for COW review" marks it pending review.
 */
@component
export class Ac04ReviewScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toDraftInReview(ui)
    const status = () => main().getState().note?.status

    // Inspect.
    expect(main().getState().phase, "review").toBe("review")
    expect(visible("DraftCard"), "draft card shown").toBe(true)
    expect(textOf("DraftTitle"), "draft labelled").toBe("Draft (simulated AI) · v1")
    expect(textOf("DraftStatus"), "not saved").toBe("Draft, not saved")
    expect(textOf("DraftLines").includes("Left knee"), "seeded error visible").toBe(true)
    expect(canTap("BtnSaveForReview"), "save locked with an unresolved flag").toBe(false)
    expect(textOf("DraftMessage"), "reason shown").toBe("Resolve flagged items first")

    // Navigation and timer bypass attempts.
    await ui.tap("BtnNext")
    expect(status(), "Next does not save").toBe("draft")
    await ui.tap("BtnBack")
    expect(main().getState().phase, "back in review").toBe("review")
    await ui.tap("BtnBack")
    await ui.tap("BtnNext")
    await sleep(3000)
    expect(status(), "Back, Next and waiting do not save").toBe("draft")

    // Reject, then a new capture and a new draft.
    await ui.tap("BtnRejectDraft")
    expect(status(), "rejected").toBe("rejected")
    expect(textOf("DraftStatus"), "rejected label").toBe("Rejected")
    expect(canTap("BtnSaveForReview"), "a rejected draft cannot be saved").toBe(false)
    await ui.tap("BtnNewCapture")
    expect(main().getState().note, "draft cleared for a new capture").toBeNull()
    expect(main().getState().noteHistory[0].outcome, "v1 kept as rejected").toBe("rejected")
    for (const b of ["BtnBack", "BtnStartCapture", "BtnStopCapture", "BtnDraftNote", "BtnNext"]) await ui.tap(b)
    expect(main().getState().note?.version, "new draft v2").toBe(2)

    // Correct the seeded error from the pick list (it replaces the draft on the card).
    await ui.tap("BtnFlagSite")
    expect(visible("PickList"), "pick list open").toBe(true)
    expect(visible("DraftCard"), "one card at a time").toBe(false)
    expect(textOf("PickTitle"), "pick list for the flag").toBe("Wound site")
    await ui.tap("BtnPickOption0")
    const s = main().getState()
    expect(s.note?.status, "edited").toBe("edited")
    expect(s.note?.version, "correction makes v3").toBe(3)
    expect(textOf("DraftLines").includes("Right knee"), "corrected text").toBe(true)
    expect(textOf("DraftLines").includes("Left knee"), "seeded error gone").toBe(false)
    expect(visible("PickList"), "pick list closed").toBe(false)

    // Bypass attempts again, now that saving is allowed.
    await ui.tap("BtnNext")
    await ui.tap("BtnBack")
    await sleep(2000)
    expect(status(), "still not saved after navigation and waiting").toBe("edited")
    expect(canTap("BtnSaveForReview"), "save unlocked").toBe(true)
  }
}
