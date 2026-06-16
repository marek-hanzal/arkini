import { useSuspenseQuery } from "@tanstack/react-query";
import { memo } from "react";
import { itemViewQueryOptions } from "~/v0/item/query/itemViewQueryOptions";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ItemId } from "~/v0/manifest/manifestId";

export namespace BoardStaticTile {
	export interface Props {
		itemId: ItemId;
	}
}

export const BoardStaticTile = memo(({ itemId }: BoardStaticTile.Props) => {
	const { data: item } = useSuspenseQuery(
		itemViewQueryOptions({
			itemId,
		}),
	);

	if (!item) return null;

	return (
		<div className="h-full w-full">
			<GameItemView
				item={item}
				variant="board"
			/>
		</div>
	);
});
