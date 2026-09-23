import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";

/** Projects one canonical authored connection view to sorted items. */
export const readItemConnectionsFn = (
	config: GameConfigSchema.Type,
	itemUid: string,
	filter: ItemConnectionFilter,
) =>
	readItemConnectionFactsFn(config, itemUid, filter)
		.flatMap(({ itemUid: connectionItemUid, origins }) => {
			const item = config.items[connectionItemUid];
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
				left.item.uid.localeCompare(right.item.uid),
		);
