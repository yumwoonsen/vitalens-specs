import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {routine} from "./CardsViewsScenario"
import {main,visible} from "./VitaLensLeafSupport"
@component
export class CompactTabsScenario extends Scenario {
 async run():Promise<void>{
  const ui=await routine();main().round.presenterMode=false
  await ui.tap("BtnTabCare")
  expect(visible("PresenterControls"),"presenter hidden in nurse mode").toBe(false)
  expect(main().getState().bodyView,"Care tab").toBe("care")
  await ui.tap("BtnTabNote");await ui.tap("BtnConsentGiven");await ui.tap("BtnStartCapture")
  await ui.tap("BtnTabSummary")
  expect(main().getState().capture,"tab interrupts capture").toBe("interrupted")
  await ui.tap("BtnTabNote")
  expect(main().getState().capture,"tab cannot resume capture").toBe("interrupted")
  await ui.tap("BtnCompactMenu");await ui.tap("BtnCompactMinimise")
  expect(main().getState().view.minimised,"manual minimise remains at bedside").toBe(true)
  await ui.tap("BtnCompactMenu");await ui.tap("BtnCompactRestore")
  expect(main().getState().view.minimised,"explicit restore").toBe(false)
  await ui.tap("BtnCompactMenu");await ui.tap("BtnCompactMirror")
  expect(main().round.sceneObject.getTransform().getWorldPosition().x,"mirror uses shared offset").toBe(main().bed2Anchor.getTransform().getWorldPosition().x-62)
  await ui.tap("BtnCompactMenu");await ui.tap("BtnCompactMotion")
  expect(main().round.reducedMotion,"motion preference").toBe(true)
 }
}
