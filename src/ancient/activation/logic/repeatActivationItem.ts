import type { ItemId } from "~/manifest/manifestId";

export const repeatActivationItem = (itemId: ItemId, quantity: number) => {
	return Array.from(
		{
			length: quantity,
		},
		() => itemId,
	);
};
