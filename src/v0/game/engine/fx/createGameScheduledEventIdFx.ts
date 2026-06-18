import { Effect } from "effect";
import { createGameScheduledEventId } from "~/v0/game/engine/logic/createGameEntityId";

export const createGameScheduledEventIdFx = Effect.fn("createGameScheduledEventIdFx")(function* () {
	return createGameScheduledEventId();
});
