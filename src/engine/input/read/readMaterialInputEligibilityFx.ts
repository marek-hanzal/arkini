import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

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
						type: "temporary",
					},
					() => false,
				)
				.with(
					{
						type: P.union(
							"blueprint",
							"craft",
							"deposit",
							"inventory",
							"producer",
							"simple",
							"stash",
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
