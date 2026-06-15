import { memo, type FC } from "react";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { GameItemView } from "~/item/ui/GameItemView";
import type { ViewItem } from "~/item/view/ViewItemSchema";

export namespace BoardTile {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}
}

export const BoardTile: FC<BoardTile.Props> = memo(({ boardItem, item, activationNowMs }) => (
	<div
		data-board-item-id={boardItem.id}
		data-board-item-tile-id={boardItem.id}
		className="h-full w-full"
	>
		<GameItemView
			item={item}
			variant="board"
			activation={boardItem.activation}
			activationNowMs={activationNowMs}
		/>
	</div>
));
