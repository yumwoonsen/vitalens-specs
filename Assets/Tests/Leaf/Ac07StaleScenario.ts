import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {canTap, main, nextTwice, slide, textOf, toSavedInReview, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC07 (plan Task 9): amending the saved note (a source edit) reopens it as a new
 * version and makes the approved handover stale. A stale handover cannot be approved;
 * it must be rebuilt from the new saved version first.
 */
@component
export class Ac07StaleScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toSavedInReview(ui)
    await nextTwice(ui)
    await ui.tap("BtnBuildHandover")
    await slide(ui, "SliderApproveHandover", 2)
    expect(main().getState().handover?.status, "approved from v2").toBe("approved")

    await ui.tap("BtnBack")
    await ui.tap("BtnBack")
    expect(main().getState().phase, "back in Review draft").toBe("review")
    await ui.tap("BtnAmendNote")
    let s = main().getState()
    expect(s.note?.version, "amend creates v3").toBe(3)
    expect(s.note?.status, "v3 is not saved").toBe("edited")
    expect(s.handover?.status, "the handover is stale").toBe("stale")
    expect(s.handover?.source.version, "it still cites v2").toBe(2)

    await ui.tap("BtnPickOption0")
    await ui.tap("BtnSaveForReview")
    s = main().getState()
    expect(s.note?.status, "v3 saved for COW review").toBe("pendingReview")
    expect(s.handover?.status, "saving does not refresh the handover").toBe("stale")

    await nextTwice(ui)
    expect(textOf("HandoverStatus"), "stale notice").toBe("Stale: a source changed. Rebuild before approval.")
    expect(textOf("HandoverLines").includes("Note v2"), "stale handover still shows its old source").toBe(true)
    expect(canTap("SliderApproveHandover"), "a stale handover cannot be approved").toBe(false)
    expect(canTap("BtnBuildHandover"), "rebuild offered").toBe(true)

    await ui.tap("BtnBuildHandover")
    s = main().getState()
    expect(s.handover?.status, "rebuilt").toBe("built")
    expect(s.handover?.source.version, "rebuilt from v3").toBe(3)
    expect(textOf("HandoverLines").includes("Note v3 (pending COW review)"), "lines cite v3").toBe(true)
    await slide(ui, "SliderApproveHandover", 2)
    expect(main().getState().handover?.status, "approved again, separately").toBe("approved")
  }
}
