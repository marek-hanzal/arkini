import { memo } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameItemView } from "~/play/runtime/useGameRuntimeViews";
import type { ItemId } from "~/config/GameIdSchema";

export namespace BoardStaticTile {
	export interface Props {
		assetProgress?: number;
		itemId: ItemId;
	}
}

export const BoardStaticTile = memo(({ assetProgress, itemId }: BoardStaticTile.Props) => {
	const item = useGameItemView(itemId);

	if (!item) return null;

	return (
		<div className="h-full w-full">
			<GameItemView
				assetProgress={assetProgress}
				item={item}
				variant="board"
			/>
		</div>
	);
});
