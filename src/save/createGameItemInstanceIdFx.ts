import { Effect } from "effect";
import { createGameItemInstanceId } from "~/engine/logic/createGameEntityId";

export const createGameItemInstanceIdFx = Effect.fn("createGameItemInstanceIdFx")(function* () {
	return createGameItemInstanceId();
});
