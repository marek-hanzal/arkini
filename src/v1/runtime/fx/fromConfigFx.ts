import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

/**
 * Builds an empty core runtime.
 *
 * Initial game content is introduced through dedicated spawn commands instead
 * of through a second board or inventory storage model.
 */
export const fromConfigFx = Effect.fn("fromConfigFx")(function* () {
	return {
		items: [] as RuntimeSchema.Type["items"],
	} satisfies RuntimeSchema.Type;
});
