import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledBoardItemReplaceFx {
	export interface Props {
		save: GameSave;
		scheduledEvent: Extract<
			GameSaveScheduledEvent,
			{
				type: "board.item.replace";
			}
		>;
		nowMs: number;
	}
}

export const processScheduledBoardItemReplaceFx = Effect.fn("processScheduledBoardItemReplaceFx")(
	function* ({ save, scheduledEvent, nowMs }: processScheduledBoardItemReplaceFx.Props) {
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.scheduledEvents[scheduledEvent.id];
		const liveItem = nextSave.board.items[scheduledEvent.itemInstanceId];
		if (!liveItem) {
			nextSave.updatedAtMs = nowMs;
			return {
				events: [],
				save: nextSave,
				type: "completed" as const,
			} satisfies GameEngineCompletionResult;
		}
		liveItem.itemId = scheduledEvent.toItemId;
		delete nextSave.stashes[scheduledEvent.itemInstanceId];
		delete nextSave.storedRequirements[scheduledEvent.itemInstanceId];
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					fromItemId: scheduledEvent.fromItemId,
					itemInstanceId: scheduledEvent.itemInstanceId,
					reason: scheduledEvent.reason,
					replacedAtMs: nowMs,
					toItemId: scheduledEvent.toItemId,
					type: "item.replaced" as const,
				},
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	},
);
