import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readMaterialInputEligibilityFx {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
	}
}

/** Checks the one canonical material-storage eligibility rule without Effect allocation. */
export const isMaterialInputEligible = (item: ItemSchema.Type) =>
	match(item)
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

/** Partitions canonical items by whether they may enter material-input storage. */
export const readMaterialInputEligibilityFx = Effect.fn("readMaterialInputEligibilityFx")(
	function* ({ items }: readMaterialInputEligibilityFx.Props) {
		const eligibleItems: ItemSchema.Type[] = [];
		const ineligibleItems: ItemSchema.Type[] = [];
		for (const item of items) {
			(isMaterialInputEligible(item) ? eligibleItems : ineligibleItems).push(item);
		}

		return {
			eligibleItems,
			ineligibleItems,
		};
	},
);
