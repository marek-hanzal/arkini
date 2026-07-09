import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";

const stableStringify = (value: unknown) => JSON.stringify(value ?? null);

export const sameBoardViewItem = (left: BoardViewItem | null, right: BoardViewItem | null) => {
	if (left === right) return true;
	if (!left || !right) return false;

	return (
		left.id === right.id &&
		left.itemId === right.itemId &&
		left.quantity === right.quantity &&
		left.x === right.x &&
		left.y === right.y &&
		stableStringify(left.activation) === stableStringify(right.activation) &&
		stableStringify(left.capacity) === stableStringify(right.capacity) &&
		stableStringify(left.craft) === stableStringify(right.craft) &&
		stableStringify(left.state) === stableStringify(right.state)
	);
};
