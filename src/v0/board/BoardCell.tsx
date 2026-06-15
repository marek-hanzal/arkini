import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { boardColumns } from "~/v0/board/boardColumns";
import { boardRows } from "~/v0/board/boardRows";
import { boardCellItemQueryOptions } from "~/v0/board/query/boardCellItemQueryOptions";
import { BoardCellCooldownProgress } from "~/v0/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/v0/board/ui/BoardCellProgress";
import type { BoardCellView } from "~/v0/board/boardCells";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { cn } from "~/v0/ui/cn";

export namespace BoardCell {
	export interface Props {
		cell: BoardCellView;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
		isOver: boolean;
	}
}

export const BoardCell = memo(({ cell, invalid, merged, imprinted, isOver }: BoardCell.Props) => {
	const { data: boardItem } = useSuspenseQuery(
		boardCellItemQueryOptions({
			cellKey: cell.key,
		}),
	);
	const clockItems = useMemo(
		() =>
			boardItem
				? [
						boardItem,
					]
				: [],
		[
			boardItem,
		],
	);
	const nowMs = useProducerClock(clockItems);
	const liveCraft = readLiveCraftView({
		craft: boardItem?.craft,
		nowMs,
	});
	const producerReady = isProducerReady(boardItem?.activation, nowMs);
	const producerCooldown = readProducerCooldown({
		activation: boardItem?.activation,
		nowMs,
	});

	return (
		<div
			data-ak-board-cell={`${cell.x}:${cell.y}`}
			data-ak-board-cell-item-id={boardItem?.id}
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
			<BoardCellProgress progress={liveCraft?.progress} />
			<BoardCellCooldownProgress progress={producerCooldown?.progress} />
		</div>
	);
});
