/**
 * LeafIndex — registers the Sunday Sort LEAF scenarios (test-only).
 * Attached to the root SceneObject "LeafIndex". Remove that object (or disable it)
 * before publishing if the tests should not ship with the Lens.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {C0_ID, C0LookDownHintScenario} from "./C0LookDownHintScenario"
import {C1_ID, C1MetforminScenario} from "./C1MetforminScenario"
import {C2_DONE_ID, C2DoneScenario} from "./C2DoneScenario"
import {C2_UNDO_ID, C2UndoScenario} from "./C2UndoScenario"
import {C3_ID, C3FurosemideScenario} from "./C3FurosemideScenario"
import {C4_ID, C4VitaminDScenario} from "./C4VitaminDScenario"
import {C5_ID, C5DoctorsChangeScenario} from "./C5DoctorsChangeScenario"
import {C5B_ID, C5bDoctorsChangeUndoScenario} from "./C5bDoctorsChangeUndoScenario"
import {IK_ID, IKReachScenario} from "./IKReachScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: C0_ID, typename: C0LookDownHintScenario.getTypeName()},
    {id: C1_ID, typename: C1MetforminScenario.getTypeName()},
    {id: C2_DONE_ID, typename: C2DoneScenario.getTypeName()},
    {id: C2_UNDO_ID, typename: C2UndoScenario.getTypeName()},
    {id: C3_ID, typename: C3FurosemideScenario.getTypeName()},
    {id: C4_ID, typename: C4VitaminDScenario.getTypeName()},
    {id: C5_ID, typename: C5DoctorsChangeScenario.getTypeName(), parameters: {stop_in_dose_change: "false"}},
    {id: C5B_ID, typename: C5bDoctorsChangeUndoScenario.getTypeName()},
    // Supplementary — IK reachability, not a done criterion.
    {id: IK_ID, typename: IKReachScenario.getTypeName()},
  ]
}
