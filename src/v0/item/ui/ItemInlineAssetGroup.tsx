import type { FC } from "react";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { cn } from "~/v0/ui/cn";
import { ItemInlineAsset } from "./ItemInlineAsset";

export namespace ItemInlineAssetGroup {
	export interface Props {
		itemIds: readonly ItemId[];
		items: ItemCatalogView;
		className?: string;
		assetClassName?: string;
	}
}

export const ItemInlineAssetGroup: FC<ItemInlineAssetGroup.Props> = ({
	assetClassName,
	className,
	itemIds,
	items,
}) => (
	<div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
		{itemIds.map((itemId) => (
			<ItemInlineAsset
				key={itemId}
				item={items[itemId]}
				className={cn("h-8 w-8", assetClassName)}
			/>
		))}
	</div>
);
