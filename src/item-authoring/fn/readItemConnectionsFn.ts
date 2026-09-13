import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";

/** Projects one canonical authored connection view to sorted items. */
export const readItemConnectionsFn = (
	config: GameConfigSchema.Type,
	itemId: string,
	filter: ItemConnectionFilter,
) =>
	readItemConnectionFactsFn(config, itemId, filter)
		.flatMap(({ itemId: connectionItemId, origins }) => {
			const item = config.items[connectionItemId];
			return item === undefined
				? []
				: [
						{
							item,
							origins,
						},
					];
		})
		.sort(
			(left, right) =>
				left.item.title.localeCompare(right.item.title) ||
				left.item.id.localeCompare(right.item.id),
		);
