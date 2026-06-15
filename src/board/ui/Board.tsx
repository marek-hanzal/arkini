import { memo, type FC, useCallback, useMemo } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardContainerNodeId } from "~/board/boardContainerNodeId";
import { boardRows } from "~/board/boardRows";
import { boardSourceId } from "~/board/boardSourceId";
import { useDelayedMergeHints } from "~/board/hook/useDelayedMergeHints";
import { BoardCell } from "~/board/ui/BoardCell";
import { BoardTile } from "~/board/ui/BoardTile";
import { cellKey } from "~/board/util/cell";
import { resolveItemMergeRule } from "~/manifest/logic/resolveItemMergeRule";
import type { ItemId } from "~/manifest/manifestId";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { DragData } from "~/play/types";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

const boardCells = Array.from(
	{
		length: boardColumns * boardRows,
	},
	(_, index) => ({
		x: index % boardColumns,
		y: Math.floor(index / boardColumns),
		key: cellKey(index % boardColumns, Math.floor(index / boardColumns)),
	}),
);

export namespace Board {
	export interface DragState {
		activeDrag?: DragData;
		isSourceHidden(sourceId: string): boolean;
	}

	export interface FeedbackState {
		invalidCellKey?: string;
		mergedCellKey?: string;
		imprintedCellKey?: string;
	}

	export interface Actions {
		tileSingleActivate(item: BoardViewItem): void;
		tileLongActivate(item: BoardViewItem): void;
	}

	export interface Props {
		drag: DragState;
		feedback: FeedbackState;
		actions: Actions;
		visualMotions: useVisualItemMotions.State;
	}
}

interface BoardTileData {
	boardItem: BoardViewItem;
	item: ViewItem;
	activationNowMs?: number;
}

export const Board: FC<Board.Props> = memo(({ drag, feedback, actions, visualMotions }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const showDelayedMergeHints = useDelayedMergeHints({
		activeDrag: drag.activeDrag ?? undefined,
	});
	const nowMs = useProducerClock(board?.items ?? []);
	const tileSlots = useMemo(
		() =>
			boardCells.map((cell) => ({
				id: cell.key,
				data: cell,
			})),
		[],
	);

	if (!board || !items) return null;

	const tileActors = board.items.flatMap((boardItem) => {
		const item = items[boardItem.itemId];
		if (!item) return [];

		const motionKey = visualBoardItemKey(boardItem.id);
		const visualMotion = visualMotions.motions[motionKey];

		return [
			{
				id: boardItem.id,
				slotId: cellKey(boardItem.x, boardItem.y),
				hidden: drag.isSourceHidden(boardSourceId(boardItem.id)),
				motion: visualMotion,
				onMotionSettle: visualMotion
					? () => visualMotions.settle(motionKey, visualMotion.nonce)
					: undefined,
				data: {
					boardItem,
					item,
					activationNowMs: boardItem.activation ? nowMs : undefined,
				} satisfies BoardTileData,
			},
		];
	});

	const renderSlot = useCallback(
		({ slot }: TileEngine.RenderSlotProps<(typeof boardCells)[number]>) => {
			const cell = slot.data;
			const boardItem = board.byCellKey[cell.key];
			const canMerge =
				drag.activeDrag?.source.kind === "board" &&
				boardItem !== undefined &&
				boardItem.id !== drag.activeDrag.source.boardItemId
					? Boolean(
							resolveItemMergeRule(
								drag.activeDrag.itemId as ItemId,
								boardItem.itemId as ItemId,
							),
						) ||
						Boolean(
							boardItem.craft?.canAcceptInputs &&
								boardItem.craft.acceptedInputItemIds.includes(
									drag.activeDrag.itemId,
								),
						) ||
						Boolean(
							boardItem.activation?.inputs.some(
								(input) =>
									input.itemId === drag.activeDrag?.itemId &&
									input.stored < input.capacity,
							),
						)
					: false;

			return (
				<BoardCell
					x={cell.x}
					y={cell.y}
					boardItem={boardItem}
					canMerge={canMerge}
					showDelayedMergeHint={showDelayedMergeHints}
					invalid={feedback.invalidCellKey === cell.key}
					merged={feedback.mergedCellKey === cell.key}
					imprinted={feedback.imprintedCellKey === cell.key}
				/>
			);
		},
		[
			board.byCellKey,
			drag.activeDrag,
			feedback.imprintedCellKey,
			feedback.invalidCellKey,
			feedback.mergedCellKey,
			showDelayedMergeHints,
		],
	);
	const renderTile = useCallback(
		({ tile }: TileEngine.RenderTileProps<BoardTileData>) => (
			<BoardTile
				boardItem={tile.data.boardItem}
				item={tile.data.item}
				activationNowMs={tile.data.activationNowMs}
				hidden={Boolean(tile.hidden)}
				onSingleActivate={actions.tileSingleActivate}
				onLongActivate={actions.tileLongActivate}
			/>
		),
		[
			actions.tileLongActivate,
			actions.tileSingleActivate,
		],
	);

	return (
		<TileEngine<BoardTileData, (typeof boardCells)[number]>
			id="board"
			columns={boardColumns}
			slots={tileSlots}
			tiles={tileActors}
			gapPx={1}
			className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
			itemLayerClassName="pointer-events-none"
			renderSlot={renderSlot}
			renderTile={renderTile}
		/>
	);
});
