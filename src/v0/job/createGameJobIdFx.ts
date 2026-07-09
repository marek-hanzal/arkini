import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

export const createGameJobIdFx = Effect.fn("createGameJobIdFx")(function* () {
	return `job:${createId()}`;
});
