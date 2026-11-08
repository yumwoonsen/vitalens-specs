import {CompactTabsScenario} from "./CompactTabsScenario"
import {CardsOverviewScenario} from "./CardsViewsScenario"
import {CardsEmergencyViewScenario} from "./CardsEmergencyViewScenario"
import {CardsGatesScenario} from "./CardsGatesScenario"
import {CardsFlowScenario} from "./CardsFlowScenario"
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {Ac01ResetScenario} from "./Ac01ResetScenario"
import {Ac02IdentifyScenario} from "./Ac02IdentifyScenario"
import {Ac03CaptureScenario} from "./Ac03CaptureScenario"
import {Ac04ReviewScenario} from "./Ac04ReviewScenario"
import {Ac05SavedScenario} from "./Ac05SavedScenario"
import {Ac06SwitchScenario} from "./Ac06SwitchScenario"
import {Ac07StaleScenario} from "./Ac07StaleScenario"
import {Ac08HandoverScenario} from "./Ac08HandoverScenario"
import {Ac09EmergencyScenario} from "./Ac09EmergencyScenario"
import {Ac11LabelsScenario} from "./Ac11LabelsScenario"
import {SetupSmokeScenario} from "./SetupSmokeScenario"
import {WardDrillScenario} from "./WardDrillScenario"
import {MinimiseRecScenario} from "./MinimiseRecScenario"
import {MinimiseStripScenario} from "./MinimiseStripScenario"
import {PrivacyModeScenario} from "./PrivacyModeScenario"
import {PrivacyBed3Scenario} from "./PrivacyBed3Scenario"

/**
 * Registers LEAF scenarios. Append new entries; do not remove existing ones.
 */
@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id:"compact-tabs",typename:CompactTabsScenario.getTypeName()},
    {id:"cards-flow",typename:CardsFlowScenario.getTypeName()},
    {id:"cards-overview",typename:CardsOverviewScenario.getTypeName()},
    {id:"cards-emergency-view",typename:CardsEmergencyViewScenario.getTypeName()},
    {id:"cards-gates",typename:CardsGatesScenario.getTypeName()},
    {
      id: "setup-smoke",
      typename: SetupSmokeScenario.getTypeName(),
    },
    {
      id: "ac01-reset",
      typename: Ac01ResetScenario.getTypeName(),
    },
    {
      id: "ac02-identify",
      typename: Ac02IdentifyScenario.getTypeName(),
    },
    {
      id: "ac11-labels",
      typename: Ac11LabelsScenario.getTypeName(),
    },
    {
      id: "ac03-capture",
      typename: Ac03CaptureScenario.getTypeName(),
    },
    {
      id: "ac04-review",
      typename: Ac04ReviewScenario.getTypeName(),
    },
    {
      id: "ac05-saved",
      typename: Ac05SavedScenario.getTypeName(),
    },
    {
      id: "ac06-switch",
      typename: Ac06SwitchScenario.getTypeName(),
    },
    {
      id: "ac07-stale",
      typename: Ac07StaleScenario.getTypeName(),
    },
    {
      id: "ac08-handover",
      typename: Ac08HandoverScenario.getTypeName(),
    },
    {
      id: "ac09-emergency",
      typename: Ac09EmergencyScenario.getTypeName(),
    },
    {id: "ward-drill", typename: WardDrillScenario.getTypeName()},
    {id: "minimise-strip", typename: MinimiseStripScenario.getTypeName()},
    {id: "minimise-rec", typename: MinimiseRecScenario.getTypeName()},
    {id: "privacy-mode", typename: PrivacyModeScenario.getTypeName()},
    {id: "privacy-bed3", typename: PrivacyBed3Scenario.getTypeName()},
  ]
}
