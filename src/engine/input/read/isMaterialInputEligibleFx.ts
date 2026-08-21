import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

/** Returns whether one canonical item may enter material-input storage. */
export const isMaterialInputEligibleFx = Effect.fnUntraced(function* (item: ItemSchema.Type) {
	return match(item)
		.with(
			{
				type: ItemEnumSchema.enum.Temporary,
			},
			() => false,
		)
		.with(
			{
				type: P.union(
					ItemEnumSchema.enum.Blueprint,
					ItemEnumSchema.enum.Craft,
					ItemEnumSchema.enum.Deposit,
					ItemEnumSchema.enum.Inventory,
					ItemEnumSchema.enum.Producer,
					ItemEnumSchema.enum.Simple,
					ItemEnumSchema.enum.Stash,
				),
			},
			() => true,
		)
		.exhaustive();
});
