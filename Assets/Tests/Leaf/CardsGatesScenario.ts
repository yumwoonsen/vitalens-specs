import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VitaLensLeafInteractor,main} from "./VitaLensLeafSupport"

/** Negative and recovery paths use actual UIKit actions on the storyboard screens. */
@component
export class CardsGatesScenario extends Scenario {
 async run():Promise<void>{
  const ui=new VitaLensLeafInteractor();await sleep(1600);main().round.presenterMode=true
  for(const b of ["BtnBed2","BtnPresenterMismatch"])await ui.tap(b)
  expect(main().getState().verification,"wrong band blocks").toBe("mismatch")
  for(const b of ["BtnRescan","BtnScanWristband","BtnConfirmName","BtnConfirmDob","BtnNext","BtnOpenNote","BtnConsentDeclined"])await ui.tap(b)
  expect(main().getState().capture,"declining consent starts nothing").toBe("idle")
  for(const b of ["BtnConsentGiven","BtnStartCapture","BtnPrivacy"])await ui.tap(b)
  expect(main().getState().capture,"privacy interrupts recording").toBe("interrupted")
  await ui.tap("BtnPrivacy")
  expect(main().getState().capture,"restore never restarts capture").toBe("interrupted")
  await ui.tap("BtnPresenterReset")
  // Core returns to Boot; Main restarts the view on the Shift overview.
  expect(main().getState().phase,"reset returns to the Shift overview").toBe("clockIn")
  expect(main().getState().bedId,"reset clears the bed").toBe(null)
 }
}
