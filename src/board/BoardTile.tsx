import { memo, useMemo } from "react";
import { BoardCellCooldownProgress } from "~/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/board/ui/BoardCellProgress";
import { readBoardTileStatus } from "~/board/view/readBoardTileStatus";
import { useBoardMemoryOperation } from "~/board-memory/BoardMemoryOperationContext";
import { readLiveBoardItemView } from "~/board/view/readLiveBoardItemView";
import { GameItemView } from "~/item/ui/GameItemView";
import { cn } from "~/ui/cn";
import { useBoardItemClock } from "~/board/useBoardItemClock";
import { readProducerCooldown } from "~/producer/view/readProducerCooldown";
import { readProducerBoardProgress } from "~/producer/view/readProducerBoardProgress";
import { useGameRuntimeSelector } from "~/play/runtime/GameRuntimeContext";
import { useGameBoardItem, useGameItemView } from "~/play/runtime/useGameRuntimeViews";
import { useLiveNowMs } from "~/time/useLiveNowMs";

export namespace BoardTile {
	export interface Props {
		boardItemId: string;
	}
}

export const BoardTile = memo(({ boardItemId }: BoardTile.Props) => {
	const boardItem = useGameBoardItem(boardItemId);
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
	const memoryOperation = useBoardMemoryOperation();
	const activeMemoryOperationUntil =
		memoryOperation?.boardItemId === boardItemId ? memoryOperation.readyAtMs : undefined;
	const boardNowMs = useBoardItemClock(clockItems);
	const memoryNowMs = useLiveNowMs([
		activeMemoryOperationUntil,
	]);
	const nowMs = activeMemoryOperationUntil === undefined ? boardNowMs : memoryNowMs;
	const item = useGameItemView(boardItem?.itemId);
	const hasSavedMemory = useGameRuntimeSelector(
		(state) => Boolean(state.runtime.save.boardMemoryLayouts[boardItemId]),
		Object.is,
	);
	const liveBoardItem = readLiveBoardItemView({
		boardItem,
		nowMs,
	});
	const tileStatus = readBoardTileStatus({
		boardItem: liveBoardItem,
		nowMs,
	});
	const producerCooldown = readProducerCooldown({
		activation: liveBoardItem?.activation,
		nowMs,
	});
	const producerProgress = readProducerBoardProgress({
		activation: liveBoardItem?.activation,
		nowMs,
	});
	const memoryProgress =
		memoryOperation?.boardItemId === boardItemId
			? Math.min(
					1,
					Math.max(
						0,
						(nowMs - memoryOperation.startedAtMs) /
							(memoryOperation.readyAtMs - memoryOperation.startedAtMs),
					),
				)
			: undefined;
	const hasActiveEffect = liveBoardItem?.activation?.lines?.some(
		(line) =>
			line.kind === "effect" &&
			line.startAtMs !== undefined &&
			line.readyAtMs !== undefined &&
			line.startAtMs <= nowMs &&
			(line.pausedAtMs !== undefined || line.readyAtMs > nowMs),
	);
	const capacity = liveBoardItem?.capacity;

	if (!boardItem || !item) return null;

	return (
		<div
			data-ui="board item"
			data-ak-board-item-id={boardItem.id}
			data-ak-board-tile-ready={tileStatus.ready ? "true" : undefined}
			data-ak-board-tile-dimmed={tileStatus.dimmed ? "true" : undefined}
			className={cn(
				"relative h-full w-full overflow-hidden transition-opacity duration-200 ease-out",
				tileStatus.dimmed ? "opacity-[0.68]" : "opacity-100",
			)}
		>
			<GameItemView
				assetProgress={hasSavedMemory ? 1 : (liveBoardItem?.craft?.inputProgress ?? 0)}
				capacityLabel={capacity ? `${capacity.remaining}/${capacity.max}` : undefined}
				item={item}
				quantity={boardItem.quantity}
				variant="board"
			/>
			{hasActiveEffect ? (
				<div className="pointer-events-none absolute right-1 top-1 rounded-sm bg-ak-primary/90 px-1 py-0.5 text-[0.56rem] font-black uppercase leading-none tracking-[0.12em] text-white shadow-sm">
					FX
				</div>
			) : null}
			<BoardCellProgress progress={liveBoardItem?.craft?.progress} />
			<BoardCellCooldownProgress
				progress={
					memoryProgress ??
					producerProgress?.progress ??
					producerCooldown?.progress ??
					(capacity ? capacity.remaining / capacity.max : undefined)
				}
			/>
		</div>
	);
});
