import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { boardItemQueryOptions } from "~/v0/board/query/boardItemQueryOptions";
import { itemViewQueryOptions } from "~/v0/item/query/itemViewQueryOptions";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ItemId } from "~/v0/manifest/manifestId";
import { useProducerClock } from "~/v0/producer/hook/useProducerClock";

export namespace BoardTile {
	export interface Props {
		boardItemId: string;
	}
}

export const BoardTile = memo(({ boardItemId }: BoardTile.Props) => {
	const { data: boardItem } = useSuspenseQuery(
		boardItemQueryOptions({
			boardItemId,
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
	const { data: item } = useSuspenseQuery(
		itemViewQueryOptions({
			itemId: (boardItem?.itemId ?? "item-seed") as ItemId,
		}),
	);

	if (!boardItem || !item) return null;

	return (
		<div
			data-ak-board-item-id={boardItem.id}
			className="h-full w-full"
		>
			<GameItemView
				item={item}
				variant="board"
				activation={boardItem.activation}
				activationNowMs={nowMs}
			/>
		</div>
	);
});
