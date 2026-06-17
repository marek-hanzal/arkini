import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/engine/fx/removeBoardItemRuntimeState";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledBoardItemRemoveFx {
	export interface Props {
		save: GameSave;
		scheduledEvent: Extract<
			GameSaveScheduledEvent,
			{
				type: "board.item.remove";
			}
		>;
		nowMs: number;
	}
}

export const processScheduledBoardItemRemoveFx = Effect.fn("processScheduledBoardItemRemoveFx")(
	function* ({ save, scheduledEvent, nowMs }: processScheduledBoardItemRemoveFx.Props) {
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
		delete nextSave.board.items[scheduledEvent.itemInstanceId];
		removeBoardItemRuntimeState({
			itemInstanceId: scheduledEvent.itemInstanceId,
			save: nextSave,
		});
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					itemId: liveItem.itemId,
					itemInstanceId: scheduledEvent.itemInstanceId,
					reason: scheduledEvent.reason,
					removedAtMs: nowMs,
					type: "item.removed" as const,
				},
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	},
);
