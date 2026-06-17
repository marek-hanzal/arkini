import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { processScheduledBoardItemRemoveFx } from "~/v0/game/engine/fx/processScheduledBoardItemRemoveFx";
import { processScheduledBoardItemReplaceFx } from "~/v0/game/engine/fx/processScheduledBoardItemReplaceFx";
import { processScheduledItemSpawnFx } from "~/v0/game/engine/fx/processScheduledItemSpawnFx";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledGameEventFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		scheduledEvent: GameSaveScheduledEvent;
		nowMs: number;
	}
}

export const processScheduledGameEventFx = Effect.fn("processScheduledGameEventFx")(function* ({
	config,
	save,
	scheduledEvent,
	nowMs,
}: processScheduledGameEventFx.Props) {
	return yield* match(scheduledEvent)
		.with(
			{
				type: "item.spawn",
			},
			(itemSpawn) =>
				processScheduledItemSpawnFx({
					config,
					nowMs,
					save,
					scheduledEvent: itemSpawn,
				}),
		)
		.with(
			{
				type: "board.item.remove",
			},
			(itemRemove) =>
				processScheduledBoardItemRemoveFx({
					nowMs,
					save,
					scheduledEvent: itemRemove,
				}),
		)
		.with(
			{
				type: "board.item.replace",
			},
			(itemReplace) =>
				processScheduledBoardItemReplaceFx({
					nowMs,
					save,
					scheduledEvent: itemReplace,
				}),
		)
		.exhaustive();
});
