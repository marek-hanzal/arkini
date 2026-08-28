import type { ItemDetailInfoProjection } from "~/ui/item-detail/ItemDetailInfoProjection";

export namespace isSameItemDetailInfoProjectionFn {
	export interface Props {
		readonly left: ItemDetailInfoProjection;
		readonly right: ItemDetailInfoProjection;
	}
}

/** Compares the complete React-visible Item Detail Info projection. */
export const isSameItemDetailInfoProjectionFn = ({
	left,
	right,
}: isSameItemDetailInfoProjectionFn.Props) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.description === right.description &&
		left.itemType === right.itemType &&
		left.storageScope === right.storageScope &&
		left.location.kind === right.location.kind &&
		(left.location.kind !== "board" ||
			right.location.kind !== "board" ||
			left.location.space === right.location.space) &&
		left.quantity === right.quantity &&
		left.maxStackSize === right.maxStackSize &&
		left.ownedQuantity === right.ownedQuantity &&
		left.maxCount === right.maxCount &&
		left.charges?.remaining === right.charges?.remaining &&
		left.charges?.total === right.charges?.total
	);
};
