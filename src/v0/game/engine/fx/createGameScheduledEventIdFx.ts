import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace createGameScheduledEventIdFx {
	export interface Props {
		save: GameSave;
	}
}

export const createGameScheduledEventIdFx = Effect.fn("createGameScheduledEventIdFx")(function* ({
	save,
}: createGameScheduledEventIdFx.Props) {
	const id = `scheduled-event:${save.nextScheduledEventIndex}`;
	save.nextScheduledEventIndex += 1;
	return id;
});
