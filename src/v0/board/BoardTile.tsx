import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { BoardCellCooldownProgress } from "~/v0/board/ui/BoardCellCooldownProgress";
import { BoardCellProgress } from "~/v0/board/ui/BoardCellProgress";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import { itemViewQueryOptions } from "~/v0/item/query/itemViewQueryOptions";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ItemId } from "~/v0/manifest/manifestId";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";
import { useGameBoardItem } from "~/v0/play/runtime";
import { cn } from "~/v0/ui/cn";

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
	const { data: item } = useSuspenseQuery(
		itemViewQueryOptions({
			itemId: (boardItem?.itemId ?? "item-seed") as ItemId,
		}),
	);
	const liveCraft = readLiveCraftView({
		craft: boardItem?.craft,
		nowMs,
	});
	const producerReady = isProducerReady(boardItem?.activation, nowMs);
	const producerCooldown = readProducerCooldown({
		activation: boardItem?.activation,
		nowMs,
	});

	if (!boardItem || !item) return null;

	return (
		<div
			data-ak-board-item-id={boardItem.id}
			className={cn(
				"relative h-full w-full overflow-hidden",
				producerReady && "ak-board-tile-ready",
			)}
		>
			<GameItemView
				item={item}
				variant="board"
				activation={boardItem.activation}
				activationNowMs={nowMs}
			/>
			<BoardCellProgress progress={liveCraft?.progress} />
			<BoardCellCooldownProgress progress={producerCooldown?.progress} />
		</div>
	);
});
