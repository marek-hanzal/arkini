import { Effect } from "effect";
import { createGameJobId } from "~/engine/logic/createGameEntityId";

export const createGameJobIdFx = Effect.fn("createGameJobIdFx")(function* () {
	return createGameJobId();
});
