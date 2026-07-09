import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { addBlueprintDependencyCycleIssue } from "~/config/validation/addBlueprintDependencyCycleIssue";
import { collectBlueprintDependencyEdges } from "~/config/validation/collectBlueprintDependencyEdges";
import { readBlueprintDependencyCycles } from "~/config/validation/readBlueprintDependencyCycles";

export const validateBlueprintDependencyCycles = (ctx: z.RefinementCtx, config: GameConfig) => {
	const collector = collectBlueprintDependencyEdges(config);
	for (const cycle of readBlueprintDependencyCycles({
		blueprintItemIds: collector.blueprintItemIds,
		edgesByBlueprintItemId: collector.edgesByBlueprintItemId,
	})) {
		addBlueprintDependencyCycleIssue({
			config,
			ctx,
			cycle,
		});
	}
};
