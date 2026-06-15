import { memo, type FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";

export namespace BoardTile {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
		onSingleActivate(item: BoardViewItem): void;
		onLongActivate(item: BoardViewItem): void;
	}
}

export const BoardTile: FC<BoardTile.Props> = memo(({ boardItem, item, activationNowMs }) => (
	<GameItemView
		item={item}
		variant="board"
		activation={boardItem.activation}
		activationNowMs={activationNowMs}
	/>
));
