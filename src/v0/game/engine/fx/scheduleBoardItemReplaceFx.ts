import { Effect } from "effect";
import { createGameScheduledEventIdFx } from "~/v0/game/engine/fx/createGameScheduledEventIdFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace scheduleBoardItemReplaceFx {
	export interface Props {
		save: GameSave;
		itemInstanceId: string;
		fromItemId: string;
		toItemId: string;
		dueAtMs: number;
		afterEventIds?: string[];
		reason: "stash-depleted";
	}
}

export const scheduleBoardItemReplaceFx = Effect.fn("scheduleBoardItemReplaceFx")(function* ({
	save,
	itemInstanceId,
	fromItemId,
	toItemId,
	dueAtMs,
	afterEventIds,
	reason,
}: scheduleBoardItemReplaceFx.Props) {
	const id = yield* createGameScheduledEventIdFx({
		save,
	});
	save.scheduledEvents[id] = {
		afterEventIds,
		dueAtMs,
		fromItemId,
		id,
		itemInstanceId,
		reason,
		toItemId,
		type: "board.item.replace",
	};
	return id;
});
