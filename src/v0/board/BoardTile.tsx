import { memo, useMemo } from "react";
import { BoardCellCooldownProgress } from "~/v0/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/v0/board/ui/BoardCellProgress";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import { cn } from "~/v0/ui/cn";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";
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
	const liveCraft = readLiveCraftView({
		craft: boardItem?.craft,
		nowMs,
	});
	const activationReady = isProducerReady(boardItem?.activation, nowMs);
	const craftReady = Boolean(liveCraft?.complete);
	const hasReadyState = Boolean(boardItem?.activation || liveCraft);
	const tileReady = !hasReadyState || activationReady || craftReady;
	const producerCooldown = readProducerCooldown({
		activation: boardItem?.activation,
		nowMs,
	});
	const producerProgress = readProducerBoardProgress({
		activation: boardItem?.activation,
		nowMs,
	});

	if (!boardItem || !item) return null;

	return (
		<div
			data-ui="board item"
			data-ak-board-item-id={boardItem.id}
			data-ak-board-tile-ready={tileReady ? "true" : undefined}
			data-ak-board-tile-dimmed={!tileReady ? "true" : undefined}
			className={cn(
				"relative h-full w-full overflow-hidden transition-opacity duration-200 ease-out",
				tileReady ? "opacity-100" : "opacity-[0.68]",
			)}
		>
			<GameItemView
				item={item}
				variant="board"
			/>
			<BoardCellProgress progress={liveCraft?.progress} />
			<BoardCellCooldownProgress
				progress={producerProgress?.progress ?? producerCooldown?.progress}
			/>
		</div>
	);
});
