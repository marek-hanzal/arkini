import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

export const createGameItemInstanceIdFx = Effect.fn("createGameItemInstanceIdFx")(function* () {
	return `item-instance:${createId()}`;
});
