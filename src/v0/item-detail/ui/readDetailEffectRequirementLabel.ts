import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readDetailItemName } from "~/v0/item-detail/ui/readDetailItemName";

const itemIdTokenPattern = /\b(?:item|producer):[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)*/gi;

export const readDetailEffectRequirementLabel = ({
	items,
	label,
}: {
	items: ItemCatalogView;
	label: string;
}) =>
	label.replace(itemIdTokenPattern, (itemId) =>
		readDetailItemName({
			itemId,
			items,
		}),
	);
