import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {canTap, claimIn, main, textOf, toDraftInReview, visibleTexts, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC05 (plan Task 8, reworded by owner round 2): the glasses never sign or file.
 * After the correction, only "Save for COW review" changes the draft, to "Draft
 * saved, pending review on COW", and no visible text claims it was filed or signed.
 */
@component
export class Ac05SavedScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toDraftInReview(ui)
    await ui.tap("BtnFlagSite")
    await ui.tap("BtnPickOption0")
    expect(main().getState().note?.status, "corrected, not saved").toBe("edited")

    await ui.tap("BtnSaveForReview")
    const s = main().getState()
    expect(s.note?.status, "pending review on the COW").toBe("pendingReview")
    expect(textOf("DraftStatus"), "saved label").toBe("Draft saved, pending review on COW")
    expect(canTap("BtnSaveForReview"), "cannot save twice").toBe(false)
    expect(canTap("BtnAmendNote"), "amend offered").toBe(true)
    const shown = visibleTexts()
    const claims = shown.map((t) => claimIn(t)).filter((c) => c !== null)
    expect(claims.length, "no live-service or sent claims: " + claims.join(", ")).toBe(0)
    const filed = shown.filter((t) => /\bfiled\b|\bsigned\b/i.test(t.replace(/Nothing is filed from the glasses/g, "")))
    expect(filed.length, "nothing claims filed or signed: " + filed.join(" | ")).toBe(0)
  }
}
