import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import type { DropPlacementResultSchema } from "~/v1/placement/schema/DropPlacementResultSchema";
import { placeOutputFx } from "./placeOutputFx";

export namespace placeDropFx {
	export interface Props {
		drop: DropResultSchema.Type;
		originItemId: IdSchema.Type;
	}
}

/**
 * Atomically places one resolved drop.
 */
export const placeDropFx = Effect.fn("placeDropFx")(function* ({
	drop,
	originItemId,
}: placeDropFx.Props) {
	const result = yield* placeOutputFx({
		originItemId,
		output: {
			drop: [
				drop,
			],
		},
	});

	return result.drop[0] satisfies DropPlacementResultSchema.Type;
});
