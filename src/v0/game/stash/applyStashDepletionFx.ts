import { Effect } from "effect";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace applyStashDepletionFx {
	export interface Props {
		save: GameSave;
		stashItemInstanceId: string;
		stashItemId: string;
		onDepleted:
			| "remove"
			| {
					replaceWithItemId: string;
			  };
		nowMs: number;
	}
}

export const applyStashDepletionFx = Effect.fn("applyStashDepletionFx")(function* ({
	save,
	stashItemInstanceId,
	stashItemId,
	onDepleted,
	nowMs,
}: applyStashDepletionFx.Props) {
	const liveItem = save.board.items[stashItemInstanceId];
	if (!liveItem) return [] satisfies GameEvent[];

	if (onDepleted === "remove") {
		delete save.board.items[stashItemInstanceId];
		removeBoardItemRuntimeState({
			itemInstanceId: stashItemInstanceId,
			save,
		});

		return [
			{
				itemId: liveItem.itemId,
				itemInstanceId: stashItemInstanceId,
				reason: "stash-depleted" as const,
				removedAtMs: nowMs,
				type: "item.removed" as const,
			},
		] satisfies GameEvent[];
	}

	liveItem.itemId = onDepleted.replaceWithItemId;
	removeBoardItemRuntimeState({
		itemInstanceId: stashItemInstanceId,
		save,
	});

	return [
		{
			fromItemId: stashItemId,
			itemInstanceId: stashItemInstanceId,
			reason: "stash-depleted" as const,
			replacedAtMs: nowMs,
			toItemId: onDepleted.replaceWithItemId,
			type: "item.replaced" as const,
		},
	] satisfies GameEvent[];
});
