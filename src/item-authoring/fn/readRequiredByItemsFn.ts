import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readRequiredByFactIdsFn } from "~/flow/fn/readRequiredByFactIdsFn";

/** Projects the canonical authored dependency graph to sorted item consumers. */
export const readRequiredByItemsFn = (config: GameConfigSchema.Type, itemId: string) =>
	readRequiredByFactIdsFn(createAcquisitionGraphFn(config), itemId)
		.flatMap((requiredByItemId) => {
			const item = config.items[requiredByItemId];
			return item === undefined
				? []
				: [
						item,
					];
		})
		.sort(
			(left, right) =>
				left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
		);
