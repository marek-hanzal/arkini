import type { ItemId } from "~/manifest/data/manifestId";

export function repeatItem(itemId: ItemId, quantity: number) {
	return Array.from(
		{
			length: quantity,
		},
		() => itemId,
	);
}
