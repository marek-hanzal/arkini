import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { isMaterialInputEligibleFn } from "./isMaterialInputEligibleFn";

export namespace readMaterialInputEligibilityFn {
	export interface Props {
		items: ReadonlyArray<ItemSchema.Type>;
	}
}

/** Partitions canonical items by whether they may enter material-input storage. */
export const readMaterialInputEligibilityFn = ({ items }: readMaterialInputEligibilityFn.Props) => {
	const eligibleItems: ItemSchema.Type[] = [];
	const ineligibleItems: ItemSchema.Type[] = [];
	for (const item of items) {
		(isMaterialInputEligibleFn(item) ? eligibleItems : ineligibleItems).push(item);
	}

	return {
		eligibleItems,
		ineligibleItems,
	};
};
