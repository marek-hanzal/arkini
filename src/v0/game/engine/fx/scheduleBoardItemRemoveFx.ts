import { Effect } from "effect";
import { createGameScheduledEventIdFx } from "~/v0/game/engine/fx/createGameScheduledEventIdFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace scheduleBoardItemRemoveFx {
	export interface Props {
		save: GameSave;
		itemInstanceId: string;
		itemId: string;
		dueAtMs: number;
		afterEventIds?: string[];
		reason: "stash-depleted";
	}
}

export const scheduleBoardItemRemoveFx = Effect.fn("scheduleBoardItemRemoveFx")(function* ({
	save,
	itemInstanceId,
	itemId,
	dueAtMs,
	afterEventIds,
	reason,
}: scheduleBoardItemRemoveFx.Props) {
	const id = yield* createGameScheduledEventIdFx({
		save,
	});
	save.scheduledEvents[id] = {
		afterEventIds,
		dueAtMs,
		id,
		itemId,
		itemInstanceId,
		reason,
		type: "board.item.remove",
	};
	return id;
});
