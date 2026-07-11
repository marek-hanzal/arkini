import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { readRuntimeFx } from "./readRuntimeFx";
import { readRuntimeItemByIdFx } from "./readRuntimeItemByIdFx";

export namespace getItemFx {
	export interface Props {
		itemId: IdSchema.Type;
	}
}

/**
 * Reads one live item by its stable runtime identity.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ itemId }: getItemFx.Props) {
	const runtime = yield* readRuntimeFx();

	return yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
});
