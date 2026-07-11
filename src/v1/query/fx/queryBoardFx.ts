import { Effect, Ref } from "effect";

import { distanceFx } from "~/v1/distance/fx/distanceFx";
import type { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { queryItemsFx } from "./queryItemsFx";

export namespace queryBoardFx {
	export interface Props {
		origin: PositionSchema.Type;
		query: QueryBoardSchema.Type;
	}
}

/**
 * Selects board items matching both the configured selector and distance rule.
 */
export const queryBoardFx = Effect.fn("queryBoardFx")(function* ({
	origin,
	query,
}: queryBoardFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);
	const selected = yield* queryItemsFx({
		items: Object.values(runtime.board.cells),
		selector: query.selector,
	});

	return yield* Effect.filter(selected, (item) => {
		return distanceFx({
			distance: query.distance,
			item: item.location.position,
			origin,
		});
	});
});
