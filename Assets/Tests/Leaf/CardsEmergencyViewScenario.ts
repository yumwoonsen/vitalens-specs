import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {main,visible} from "./VitaLensLeafSupport"

import {routine} from "./CardsViewsScenario"
/** Leaves independent alert-linked emergency visible; camera proximity controls layout. */
@component
export class CardsEmergencyViewScenario extends Scenario {
 async run():Promise<void>{const ui=await routine();await ui.tap("BtnPresenterEmergency");expect(main().getState().emergencyPatientId,"alert-linked record").toBe("pt-target");expect(visible("EmergencyTravel")||visible("EmergencyScreen"),"emergency screen shown").toBe(true)
  for(const side of ["left","right","left"]){
   await ui.tap("BtnPresenterCorner")
   expect(main().getState().view.miniCorner,"cached presenter side switch").toBe(side)
  }
  await ui.tap("BtnPresenterEmergency");expect(main().getState().phase,"End drill returns to the ward").toBe("clockIn")}
}
