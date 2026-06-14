import type { ItemId } from "~/manifest/manifestId";

export function repeatItem(itemId: ItemId, quantity: number) {
	return Array.from(
		{
			length: quantity,
		},
		() => itemId,
	);
}
