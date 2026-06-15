import type { ItemId } from "~/v0/manifest/manifestId";

export const repeatActivationItem = (itemId: ItemId, quantity: number) => {
	return Array.from(
		{
			length: quantity,
		},
		() => itemId,
	);
};
