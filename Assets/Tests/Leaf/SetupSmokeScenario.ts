import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"

/**
 * Setup smoke check (plan Task 1). Proves LEAF can start a scenario in the
 * Lens Studio preview and read the starter scene. It tests no VitaLens
 * behaviour and maps to no acceptance criterion.
 */
@component
export class SetupSmokeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)

    const sik = findSceneObjectByName("SpectaclesInteractionKit")
    expect(sik !== undefined, "SpectaclesInteractionKit root exists").toBe(true)
    expect(sik.enabled, "SpectaclesInteractionKit root is enabled").toBe(true)

    const cameraObject = findSceneObjectByName("Camera Object")
    expect(cameraObject !== undefined, "Camera Object exists").toBe(true)
    expect(
      cameraObject.getComponent("Component.Camera") !== null,
      "Camera Object has a Camera component",
    ).toBe(true)
  }
}
