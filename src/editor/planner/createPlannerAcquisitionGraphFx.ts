import { Effect } from "effect";

import { createPlannerAcquisitionGraph } from "~/editor/planner/createPlannerAcquisitionGraph";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Effect boundary for constructing the planner's immutable authored acquisition graph. */
export const createPlannerAcquisitionGraphFx = Effect.fn("createPlannerAcquisitionGraphFx")(
	(config: GameConfigSchema.Type) => Effect.sync(() => createPlannerAcquisitionGraph(config)),
);
