import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {canTap, main, nextTwice, slide, textOf, toDraftInReview, VitaLensLeafInteractor} from "./VitaLensLeafSupport"

/**
 * AC08 (plan Task 9): the handover is built only from the saved note and the record,
 * every ISBAR line shows its source, unknowns and pending tasks keep their owners, and
 * approval is a separate, deliberate slide. Navigation, waiting and a partial slide
 * never approve it, and approval leaves the note unchanged.
 */
@component
export class Ac08HandoverScenario extends Scenario {
  async run(): Promise<void> {
    const ui = new VitaLensLeafInteractor()
    await toDraftInReview(ui)
    await nextTwice(ui)
    expect(main().getState().phase, "at Handover").toBe("handover")
    expect(canTap("BtnBuildHandover"), "no build from an unsaved draft").toBe(false)
    expect(textOf("HandoverStatus").includes("No saved note"), "reason shown").toBe(true)

    await ui.tap("BtnBack")
    await ui.tap("BtnBack")
    for (const b of ["BtnFlagSite", "BtnPickOption0", "BtnSaveForReview"]) await ui.tap(b)
    await nextTwice(ui)
    await ui.tap("BtnBuildHandover")
    const built = main().getState()
    expect(built.handover?.status, "built").toBe("built")

    const lines = textOf("HandoverLines").split("\n")
    expect(lines.length, "six ISBAR lines").toBe(6)
    const unsourced = lines.filter((l) => !/\(.+\)$/.test(l))
    expect(unsourced.length, "every line has a source: " + unsourced.join(" | ")).toBe(0)
    expect(lines.some((l) => l.includes("Code status: Full code")), "code status from the record").toBe(true)
    expect(lines.some((l) => l.includes("Note v2 (pending COW review)")), "cites the saved note").toBe(true)
    const tasks = textOf("HandoverTasks")
    expect(tasks.includes("Pending: Obs due 10:00. Owner: Oncoming nurse, Bed 3"), "task 1 with owner").toBe(true)
    expect(tasks.includes("Owner: Day shift nurse"), "task 2 with owner").toBe(true)

    // Bypass attempts: waiting, Next, Back then Next, and a partial slide.
    await sleep(2500)
    expect(canTap("BtnNext"), "Next is off at the last phase").toBe(false)
    await ui.tap("BtnBack")
    await ui.tap("BtnNext")
    await slide(ui, "SliderApproveHandover", 0.1)
    expect(main().getState().handover?.status, "still not approved").toBe("built")

    await slide(ui, "SliderApproveHandover", 2)
    const approved = main().getState()
    expect(approved.handover?.status, "approved by the full slide").toBe("approved")
    expect(JSON.stringify(approved.note), "the note is unchanged").toBe(JSON.stringify(built.note))
    expect(approved.noteHistory.length, "history unchanged").toBe(built.noteHistory.length)
    expect(textOf("HandoverStatus"), "approved, not sent").toBe("Handover approved. Not sent (simulated).")
    expect(textOf("HandoverTasks").includes("Pending"), "tasks stay pending").toBe(true)
  }
}
