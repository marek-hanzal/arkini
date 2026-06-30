import { memo } from "react";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import { useGameItemView } from "~/v0/play/runtime";
import type { ItemId } from "~/v0/game/config/GameIdSchema";

export namespace BoardStaticTile {
	export interface Props {
		itemId: ItemId;
	}
}

export const BoardStaticTile = memo(({ itemId }: BoardStaticTile.Props) => {
	const item = useGameItemView(itemId);

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
