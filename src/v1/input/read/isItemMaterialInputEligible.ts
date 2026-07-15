import { match, P } from "ts-pattern";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";

/**
 * Reports whether one canonical item may enter material-input storage.
 *
 * Material selectors describe their complete accepted candidate set, so every
 * item matched by one selector must satisfy this capability boundary.
 */
export const isItemMaterialInputEligible = (item: ItemSchema.Type) => {
	return match(item)
		.with(
			{
				type: "temporary",
			},
			() => false,
		)
		.with(
			{
				type: P.union(
					"blueprint",
					"cheat:inventory",
					"cheat:speed",
					"craft",
					"deposit",
					"inventory",
					"memory",
					"nuke",
					"producer",
					"simple",
					"stash",
				),
			},
			() => true,
		)
		.exhaustive();
};
