import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { BlueprintDependencyCycle } from "~/config/validation/BlueprintDependencyTypes";
import { addIssue } from "~/config/validation/GameConfigValidationCommon";
import { readBlueprintItemDisplayName } from "~/config/validation/readBlueprintDependencyItems";

export const addBlueprintDependencyCycleIssue = ({
	config,
	ctx,
	cycle,
}: {
	config: GameConfig;
	ctx: z.RefinementCtx;
	cycle: BlueprintDependencyCycle;
}) => {
	const firstCycleEdge = cycle.edges[0];
	const issuePath = firstCycleEdge?.path ?? [
		"items",
		cycle.blueprintItemIds[0] ?? "blueprints",
	];
	const cycleLabel = cycle.blueprintItemIds
		.map((itemId) => readBlueprintItemDisplayName(config, itemId))
		.join(" -> ");
	const viaLabel = firstCycleEdge ? ` via required item "${firstCycleEdge.viaItemId}"` : "";

	addIssue(
		ctx,
		issuePath,
		`Blueprint dependency cycle detected${viaLabel}: ${cycleLabel}. Blueprint progression must not require itself directly or through another blueprint/building chain.`,
	);
};
