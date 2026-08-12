import { Effect, Layer } from "effect";

import { SpatialRelationFx } from "~/engine/distance/context/SpatialRelationFx";
import { makeOptimisticSpatialRelationFx } from "~/engine/distance/fx/makeOptimisticSpatialRelationFx";
import { OutputResolutionFx } from "~/engine/output/context/OutputResolutionFx";
import { outputFx } from "~/engine/output/fx/outputFx";
import { PlacementPolicyFx } from "~/engine/placement/context/PlacementPolicyFx";
import { planOptimisticDropPlacementFx } from "~/engine/placement/fx/planOptimisticDropPlacementFx";
import { readOptimisticRuntimeItemDropLocationFx } from "~/engine/placement/fx/readOptimisticRuntimeItemDropLocationFx";
import { RuntimeTimePolicyFx } from "~/engine/tick/context/RuntimeTimePolicyFx";
import { WhenEvaluationFx } from "~/engine/when/context/WhenEvaluationFx";
import { makeOptimisticWhenEvaluationFx } from "~/engine/when/fx/makeOptimisticWhenEvaluationFx";

/**
 * Optimistic policies used by engine-backed planning.
 *
 * Economy, identity, scopes and authored quantities remain canonical. The planner
 * relaxes physical geometry, finite grid capacity and wall-clock waiting only.
 */
export const PlannerGamePolicyLayerFx = Layer.mergeAll(
	Layer.effect(SpatialRelationFx, makeOptimisticSpatialRelationFx()),
	Layer.effect(WhenEvaluationFx, makeOptimisticWhenEvaluationFx()),
	Layer.succeed(PlacementPolicyFx, {
		planDrop: planOptimisticDropPlacementFx,
		readItemDropLocation: readOptimisticRuntimeItemDropLocationFx,
	}),
	Layer.succeed(OutputResolutionFx, {
		resolve: outputFx,
	}),
	Layer.succeed(RuntimeTimePolicyFx, {
		completeTimedWorkInstantly: () => Effect.succeed(true),
		shouldAdvanceTemporaryItem: () => Effect.succeed(false),
	}),
);
