import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionFactIdsFn } from "~/flow/fn/readItemConnectionFactIdsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";

/** Projects one canonical authored connection view to sorted items. */
export const readItemConnectionsFn = (
	config: GameConfigSchema.Type,
	itemId: string,
	filter: ItemConnectionFilter,
) =>
	readItemConnectionFactIdsFn(config, itemId, filter)
		.flatMap((connectionItemId) => {
			const item = config.items[connectionItemId];
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
