import { Effect } from "effect";

import type { PlannerAcquisitionRequirement } from "~/editor/planner/PlannerAcquisitionGraph";

/** Orders authored prerequisite sources for deterministic planner decomposition. */
export const readPlannerRequirementSourcePriorityFx = Effect.fn(
	"readPlannerRequirementSourcePriorityFx",
)((source: PlannerAcquisitionRequirement["source"]) =>
	Effect.sync(() => {
		switch (source) {
			case "owner":
			case "merge-source":
			case "merge-target":
				return 0;
			case "charged-item":
			case "temporary-item":
				return 1;
			case "deposit-input":
			case "material-input":
				return 2;
			case "line-condition":
			case "output-condition":
				return 3;
		}
	}),
);
