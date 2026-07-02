import { memo } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameItemView } from "~/play/runtime/useGameRuntimeViews";
import type { ItemId } from "~/config/GameIdSchema";

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
