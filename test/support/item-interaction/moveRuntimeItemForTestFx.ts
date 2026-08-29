import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import { dropItemFx } from "~/item-interaction/write/dropItemFx";

/** Uses the public drop command to arrange a successful grid move for another regression. */
export const moveRuntimeItemForTestFx = Effect.fn("moveRuntimeItemForTestFx")(function* ({
	itemId,
	location,
	revision,
}: {
	readonly itemId: IdSchema.Type;
	readonly location: GridLocationSchema.Type;
	readonly revision: RevisionSchema.Type;
}) {
	const runtime = yield* readRuntimeFx();
	const source = Option.getOrUndefined(
		isGridRuntimeItemFn(
			yield* readRuntimeItemByIdFx({
				itemId,
				runtime,
			}),
		),
	);
	if (source === undefined) {
		return yield* Effect.die(new Error(`Expected grid item "${itemId}".`));
	}
	const result = yield* dropItemFx({
		sourceItemId: itemId,
		sourceRevision: revision,
		sourceLocation: source.location,
		target: {
			kind: "slot",
			location,
			occupant: null,
		},
	});
	if (result.kind !== DropItemResultKind.Move) {
		return yield* Effect.die(
			new Error(`Expected move interaction, received "${result.kind}".`),
		);
	}
	return {
		item: yield* readRuntimeItemByIdFx({
			itemId,
			runtime: yield* readRuntimeFx(),
		}),
		previousLocation: result.previousLocation,
	};
});
