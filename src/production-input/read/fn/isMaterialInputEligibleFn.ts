import { match, P } from "ts-pattern";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

/** Returns whether one canonical item may enter material-input storage. */
export const isMaterialInputEligibleFn = (item: ItemSchema.Type) =>
	match(item)
		.with(
			{
				type: TypeSchema.enum.Temporary,
			},
			() => false,
		)
		.with(
			{
				type: P.union(
					TypeSchema.enum.Blueprint,
					TypeSchema.enum.Craft,
					TypeSchema.enum.Deposit,
					TypeSchema.enum.Inventory,
					TypeSchema.enum.Producer,
					TypeSchema.enum.Simple,
					TypeSchema.enum.Space,
					TypeSchema.enum.Stash,
				),
			},
			() => true,
		)
		.exhaustive();
