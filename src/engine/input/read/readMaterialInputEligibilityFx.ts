import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { isMaterialInputEligibleFx } from "./isMaterialInputEligibleFx";

export namespace readMaterialInputEligibilityFx {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
	}
}

/** Partitions canonical items by whether they may enter material-input storage. */
export const readMaterialInputEligibilityFx = Effect.fn("readMaterialInputEligibilityFx")(
	function* ({ items }: readMaterialInputEligibilityFx.Props) {
		const eligibleItems: ItemSchema.Type[] = [];
		const ineligibleItems: ItemSchema.Type[] = [];
		for (const item of items) {
			((yield* isMaterialInputEligibleFx(item)) ? eligibleItems : ineligibleItems).push(item);
		}

		return {
			eligibleItems,
			ineligibleItems,
		};
	},
);
