import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";

interface GetItemProps {
	itemId: IdSchema.Type;
}

/**
 * Reads one live item by its stable runtime identity.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ itemId }: GetItemProps) {
	const runtime = yield* readRuntimeFx();

	return yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
});
