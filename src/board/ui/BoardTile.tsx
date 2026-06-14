import { memo, type FC, useCallback, useMemo } from "react";
import { boardCellNodeId } from "~/board/boardCellNodeId";
import { boardSourceId } from "~/board/boardSourceId";
import { DraggableSurface } from "~/drag/ui/DraggableSurface";
import { GameItemView } from "~/item/ui/GameItemView";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { DragData } from "~/play/types";

export namespace BoardTile {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
		hidden: boolean;
		onSingleActivate(item: BoardViewItem): void;
		onDoubleActivate(item: BoardViewItem): void;
		onLongActivate(item: BoardViewItem): void;
	}
}

export const BoardTile: FC<BoardTile.Props> = memo(
	({
		boardItem,
		item,
		activationNowMs,
		hidden,
		onSingleActivate,
		onDoubleActivate,
		onLongActivate,
	}) => {
		const sourceId = boardSourceId(boardItem.id);
		const sourceNodeId = boardCellNodeId(boardItem.x, boardItem.y);
		const payload = useMemo(
			() =>
				({
					sourceId,
					sourceNodeId,
					itemId: boardItem.itemId,
					source: {
						kind: "board" as const,
						boardItemId: boardItem.id,
					},
					overlay: {
						activation: boardItem.activation,
					},
					hideWhenActive: true,
				}) satisfies DragData,
			[
				boardItem.activation,
				boardItem.id,
				boardItem.itemId,
				sourceId,
				sourceNodeId,
			],
		);
		const handleSingleActivate = useCallback(
			() => onSingleActivate(boardItem),
			[
				boardItem,
				onSingleActivate,
			],
		);
		const handleDoubleActivate = useCallback(
			() => onDoubleActivate(boardItem),
			[
				boardItem,
				onDoubleActivate,
			],
		);
		const handleLongActivate = useCallback(
			() => onLongActivate(boardItem),
			[
				boardItem,
				onLongActivate,
			],
		);

		return (
			<DraggableSurface
				id={sourceId}
				nodeId={`${sourceId}:drag`}
				payload={payload}
				data-board-item-id={boardItem.id}
				hidden={hidden}
				className="absolute inset-0 touch-none"
				onSingleActivate={handleSingleActivate}
				delaySingleWhenDouble
				onDoubleActivate={handleDoubleActivate}
				onLongActivate={handleLongActivate}
			>
				<GameItemView
					item={item}
					variant="board"
					activation={boardItem.activation}
					activationNowMs={activationNowMs}
				/>
			</DraggableSurface>
		);
	},
);
