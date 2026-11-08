import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VitaLensLeafInteractor,main,visible} from "./VitaLensLeafSupport"

/** Accepted flow on the storyboard screens. Uses actual enabled UIKit interactions, not direct reducer calls. */
@component
export class CardsFlowScenario extends Scenario {
 async run():Promise<void>{
  const ui=new VitaLensLeafInteractor()
  await sleep(1600);main().round.presenterMode=true
  for(const b of ["BtnBed2","BtnScanWristband","BtnConfirmName","BtnConfirmDob"])await ui.tap(b)
  expect(main().getState().scannedPatientId,"routine patient").toBe("pt-bed2")
  expect(visible("WristbandScreen"),"verified wristband screen holds until Next").toBe(true)
  await ui.tap("BtnNext")
  expect(visible("PatientScreen"),"patient overview after Next").toBe(true)
  for(const b of ["BtnOpenNote","BtnConsentGiven","BtnStartCapture","BtnStopCapture"])await ui.tap(b)
  expect(main().getState().note?.status,"Stop presents draft").toBe("draft")
  expect(main().getState().note?.flags[0].resolution,"seeded correction required").toBe(null)
  for(const b of ["BtnCorrectSite","BtnSaveForReview","BtnDownstream"])await ui.tap(b)
  expect(main().getState().note?.status,"deliberately saved only").toBe("pendingReview")
  for(const b of ["BtnCowSign","BtnEhrReceive"])await ui.tap(b)
  expect(main().getState().downstream[0].stage,"external simulator").toBe("received")
  await ui.tap("BtnPresenterEmergency")
  expect(main().getState().emergencyPatientId,"independent immediate target").toBe("pt-target")
  expect(main().getState().emergencyBand,"not scan-gated").toBe("none")
  await ui.tap("BtnPresenterWrongBand")
  expect(main().getState().emergencyBand,"mismatch warning").toBe("mismatch")
  expect(main().getState().emergencyPatientId,"mismatch does not replace alert record").toBe("pt-target")
  await ui.tap("BtnCallDoctor")
  expect(main().getState().emergencyContact,"call simulated").toBe(true)
  await ui.tap("BtnPresenterEmergency")
  expect(main().getState().phase,"returns to ward").toBe("clockIn")
  expect(main().getState().bedId,"no active patient").toBe(null)
  expect(main().getState().interruptedWork["pt-bed2"]?.note?.version,"existing version retained").toBe(2)
  for(const b of ["BtnBed2","BtnScanWristband","BtnConfirmName","BtnConfirmDob","BtnNext"])await ui.tap(b)
  expect(main().getState().note,"no automatic reopen").toBe(null)
  await ui.tap("BtnReopenWork")
  expect(main().getState().note?.version,"explicit reopen restores same version").toBe(2)
  expect(main().getState().consent,"consent is not restored").toBe("unasked")
  expect(main().getState().capture,"capture is not restarted").toBe("idle")
  expect(visible("PatientScreen"),"patient screen visible").toBe(true)
 }
}
