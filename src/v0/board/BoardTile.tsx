import { memo, useMemo } from "react";
import { BoardCellCooldownProgress } from "~/v0/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/v0/board/ui/BoardCellProgress";
import { readBoardTileStatus } from "~/v0/board/logic/readBoardTileStatus";
import { readLiveBoardItemView } from "~/v0/board/logic/readLiveBoardItemView";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import { cn } from "~/v0/ui/cn";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";
import { readProducerBoardProgress } from "~/v0/producer/logic/readProducerBoardProgress";
import { useGameBoardItem, useGameItemView } from "~/v0/play/runtime";

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
	const nowMs = useProducerClock(clockItems);
	const item = useGameItemView(boardItem?.itemId);
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
	const hasActiveEffect = liveBoardItem?.activation?.lines?.some(
		(line) =>
			line.kind === "effect" &&
			line.startAtMs !== undefined &&
			line.readyAtMs !== undefined &&
			line.startAtMs <= nowMs &&
			(line.pausedAtMs !== undefined || line.readyAtMs > nowMs),
	);

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
				assetProgress={liveBoardItem?.craft?.inputProgress}
				item={item}
				variant="board"
			/>
			{hasActiveEffect ? (
				<div className="pointer-events-none absolute right-1 top-1 rounded-sm bg-ak-primary/90 px-1 py-0.5 text-[0.56rem] font-black uppercase leading-none tracking-[0.12em] text-white shadow-sm">
					FX
				</div>
			) : null}
			<BoardCellProgress progress={liveBoardItem?.craft?.progress} />
			<BoardCellCooldownProgress
				progress={producerProgress?.progress ?? producerCooldown?.progress}
			/>
		</div>
	);
});
