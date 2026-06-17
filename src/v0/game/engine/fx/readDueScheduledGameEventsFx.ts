import { Effect } from "effect";
import { compareScheduledGameEvents } from "~/v0/game/engine/fx/compareScheduledGameEvents";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readDueScheduledGameEventsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readDueScheduledGameEventsFx = Effect.fn("readDueScheduledGameEventsFx")(function* ({
	save,
	nowMs,
}: readDueScheduledGameEventsFx.Props) {
	return Object.values(save.scheduledEvents)
		.filter((event) => event.dueAtMs <= nowMs)
		.sort(compareScheduledGameEvents);
});
