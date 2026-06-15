import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { boardCells, type BoardCellView } from "~/board/boardCells";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import { cellKey } from "~/board/util/cell";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { Command } from "~/command/Command";
import { GameItemView } from "~/item/ui/GameItemView";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { cn } from "~/shared/cn";
import { inventoryViewQueryOptions } from "~/v0/query/inventoryViewQueryOptions";
import { itemCatalogQueryOptions } from "~/v0/query/itemCatalogQueryOptions";
import { boardViewQueryOptions } from "~/v0/query/boardViewQueryOptions";
import { useGameCommandMutation } from "~/v0/mutation/useGameCommandMutation";
import type { V0DragSource, V0DropTarget } from "~/v0/play/V0DragTypes";
import type { V0Feedback } from "~/v0/play/V0Feedback";
import { resolveV0Drop } from "~/v0/play/resolveV0Drop";
import { TileEngine } from "~/v0/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

export namespace V0BoardSurface {
	export interface Props {
		feedback: V0Feedback;
		hasFeedback(key: string): boolean;
		onOpenItem(boardItemId: string): void;
	}

	export interface TileData {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
	}
}

const boardSlots = boardCells.map((cell) => ({
	id: cell.key,
	data: cell,
})) satisfies readonly TileEngineType.Slot<BoardCellView>[];

const renderBoardTile = ({ tile }: TileEngineType.RenderTileProps<V0BoardSurface.TileData>) => (
	<div
		data-v0-board-item-id={tile.data.boardItem.id}
		className="h-full w-full"
	>
		<GameItemView
			item={tile.data.item}
			variant="board"
			activation={tile.data.boardItem.activation}
			activationNowMs={tile.data.activationNowMs}
		/>
	</div>
);

const BoardCell = memo(
	({
		cell,
		boardItem,
		invalid,
		merged,
		imprinted,
		isOver,
		nowMs,
	}: {
		cell: BoardCellView;
		boardItem?: BoardViewItem;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
		isOver: boolean;
		nowMs: number;
	}) => {
		const producerReady = isProducerReady(boardItem?.activation, nowMs);
		const producerCooldown = readProducerCooldown({
			activation: boardItem?.activation,
			nowMs,
		});

		return (
			<div
				data-v0-board-cell={`${cell.x}:${cell.y}`}
				data-v0-board-cell-item-id={boardItem?.id}
				className={cn(
					"relative aspect-square touch-none border-b border-r border-slate-800/65 bg-slate-900/45",
					cell.x === boardColumns - 1 && "border-r-0",
					cell.y === boardRows - 1 && "border-b-0",
					isOver &&
						"bg-slate-800/80 outline outline-2 -outline-offset-2 outline-emerald-300/80",
					producerReady && !invalid && "ak-producer-ready",
					invalid && "ak-cell-error",
					merged && "ak-merge-target-over",
					imprinted && "ak-merge-target",
				)}
			>
				<BoardCellProgress progress={boardItem?.craft?.progress} />
				<BoardCellCooldownProgress progress={producerCooldown?.progress} />
			</div>
		);
	},
);

export const V0BoardSurface = memo(
	({ feedback, hasFeedback, onOpenItem }: V0BoardSurface.Props) => {
		const { data: board } = useSuspenseQuery(boardViewQueryOptions());
		const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
		const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
		const command = useGameCommandMutation();
		const nowMs = useProducerClock(board.items);

		const run = command.mutateAsync;
		const tiles = useMemo(
			() =>
				board.items.flatMap((boardItem) => {
					const item = items[boardItem.itemId];
					if (!item) return [];

					return [
						{
							id: boardItem.id,
							slotId: cellKey(boardItem.x, boardItem.y),
							data: {
								boardItem,
								item,
								activationNowMs: boardItem.activation ? nowMs : undefined,
							},
						},
					] satisfies TileEngineType.Tile<V0BoardSurface.TileData>[];
				}),
			[
				board.items,
				items,
				nowMs,
			],
		);
		const activateBoardItem = useCallback(
			(boardItem: BoardViewItem) => {
				if (boardItem.craft?.complete) {
					command.mutate({
						type: "craft.claim",
						boardItemId: boardItem.id,
					});
					return;
				}

				if (!boardItem.activation) return;
				command.mutate({
					type: "activation.activate",
					boardItemId: boardItem.id,
					activation: boardItem.activation.kind === "stash" ? "exhaust" : "single",
				});
			},
			[
				command.mutate,
			],
		);
		const drag = useMemo<
			TileEngineType.DragConfig<
				V0BoardSurface.TileData,
				BoardCellView,
				V0DragSource,
				V0DropTarget
			>
		>(
			() => ({
				tile(tile) {
					const boardItem = tile.data.boardItem;
					return {
						id: `board:${boardItem.id}`,
						data: {
							kind: "board",
							boardItemId: boardItem.id,
							itemId: boardItem.itemId,
							boardItem,
						},
						onSingleActivate: () => activateBoardItem(boardItem),
						onLongActivate: () => onOpenItem(boardItem.id),
					};
				},
				slot(slot, targetTile) {
					const cell = slot.data;
					return {
						id: `board-cell:${cell.key}`,
						data: {
							kind: "cell",
							x: cell.x,
							y: cell.y,
							boardItemId: targetTile?.data.boardItem.id,
						},
					};
				},
				onDrop(context) {
					return resolveV0Drop({
						context,
						board,
						inventory,
						feedback,
						run,
					});
				},
				onDragCancel() {
					// The engine owns visual rollback. App state remains untouched until commit.
				},
			}),
			[
				activateBoardItem,
				board,
				feedback,
				inventory,
				onOpenItem,
				run,
			],
		);
		const renderSlot = useCallback(
			({ slot, isOver }: TileEngineType.RenderSlotProps<BoardCellView>): ReactNode => {
				const cell = slot.data;
				const key = cell.key;
				return (
					<BoardCell
						cell={cell}
						boardItem={board.byCellKey[key]}
						invalid={hasFeedback(`board:error:${key}`)}
						merged={hasFeedback(`board:merge:${key}`)}
						imprinted={hasFeedback(`board:imprint:${key}`)}
						isOver={isOver}
						nowMs={nowMs}
					/>
				);
			},
			[
				board.byCellKey,
				hasFeedback,
				nowMs,
			],
		);

		return (
			<TileEngine<V0BoardSurface.TileData, BoardCellView, V0DragSource, V0DropTarget>
				id="v0-board"
				columns={boardColumns}
				slots={boardSlots}
				tiles={tiles}
				gapPx={1}
				className="w-full rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
				itemLayerClassName="pointer-events-none"
				drag={drag}
				renderSlot={renderSlot}
				renderTile={renderBoardTile}
			/>
		);
	},
);
