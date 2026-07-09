import { memo } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameItemView } from "~/play/runtime/useGameRuntimeViews";
import type { ItemId } from "~/config/IdSchema";

export namespace BoardStaticTile {
	export interface Props {
		assetProgress?: number;
		itemId: ItemId;
		quantity?: number;
	}
}

export const BoardStaticTile = memo(
	({ assetProgress, itemId, quantity }: BoardStaticTile.Props) => {
		const item = useGameItemView(itemId);

		if (!item) return null;

		return (
			<div className="h-full w-full">
				<GameItemView
					assetProgress={assetProgress}
					item={item}
					quantity={quantity}
					variant="board"
				/>
			</div>
		);
	},
);
