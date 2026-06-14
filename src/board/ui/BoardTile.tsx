import type { FC } from "react";
import { boardCellNodeId, boardSourceId } from "~/board/boardIdentity";
import { DraggableSurface } from "~/drag/ui/DragSurface";
import { GameItemView } from "~/item/ui/GameItemView";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { GameDragData } from "~/play/types";

export namespace BoardTile {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
		nowMs: number;
		hidden: boolean;
		onSingleActivate(): void;
		onDoubleActivate(): void;
		onLongActivate(): void;
	}
}

export const BoardTile: FC<BoardTile.Props> = ({
	boardItem,
	item,
	nowMs,
	hidden,
	onSingleActivate,
	onDoubleActivate,
	onLongActivate,
}) => {
	const sourceId = boardSourceId(boardItem.id);
	const sourceNodeId = boardCellNodeId(boardItem.x, boardItem.y);

	return (
		<DraggableSurface
			id={sourceId}
			nodeId={`${sourceId}:drag`}
			payload={
				{
					sourceId,
					sourceNodeId,
					itemId: boardItem.itemId,
					source: {
						kind: "board",
						boardItemId: boardItem.id,
					},
					overlay: {
						activation: boardItem.activation,
					},
					hideWhenActive: true,
				} satisfies GameDragData
			}
			data-board-item-id={boardItem.id}
			hidden={hidden}
			className="absolute inset-0 touch-none"
			onSingleActivate={onSingleActivate}
			delaySingleWhenDouble
			onDoubleActivate={onDoubleActivate}
			onLongActivate={onLongActivate}
		>
			<GameItemView
				item={item}
				variant="board"
				activation={boardItem.activation}
				activationNowMs={nowMs}
			/>
		</DraggableSurface>
	);
};
