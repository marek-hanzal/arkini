import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readMaterialInputEligibilityFx {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
	}
}

/** Partitions canonical items by whether they may enter material-input storage. */
export const readMaterialInputEligibilityFx = Effect.fn("readMaterialInputEligibilityFx")(
	function* ({ items }: readMaterialInputEligibilityFx.Props) {
		const isEligible = (item: ItemSchema.Type) => {
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
		};

		return {
			eligibleItems: items.filter(isEligible),
			ineligibleItems: items.filter((item) => !isEligible(item)),
		};
	},
);
