import { Effect, Random } from "effect";

import type { ChanceSchema } from "~/v1/common/schema/ChanceSchema";

export namespace testChanceFx {
	export interface Props {
		chance: ChanceSchema.Type;
	}
}

/**
 * Resolves one probability check without knowing anything about its caller.
 */
export const testChanceFx = Effect.fn("testChanceFx")(function* ({ chance }: testChanceFx.Props) {
	const value = yield* Random.next;

	return value < chance;
});
