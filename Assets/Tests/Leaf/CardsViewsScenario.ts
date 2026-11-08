import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {VitaLensLeafInteractor,main,visible} from "./VitaLensLeafSupport"

export async function routine():Promise<VitaLensLeafInteractor>{
 const ui=new VitaLensLeafInteractor();await sleep(1600);main().round.presenterMode=true
 for(const b of ["BtnBed2","BtnScanWristband","BtnConfirmName","BtnConfirmDob","BtnNext"])await ui.tap(b)
 return ui
}
/** Leaves the accepted overview visible for repeatable native visual review. */
@component
export class CardsOverviewScenario extends Scenario {
 async run():Promise<void>{await routine();expect(visible("PatientScreen"),"patient overview shown").toBe(true);expect(main().getState().scannedPatientId,"routine patient").toBe("pt-bed2")}
}
