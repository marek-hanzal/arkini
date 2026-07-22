import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { outputFx } from "~/engine/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { makeTemporaryExpiryRandomFx } from "~/engine/item/temporary/random/makeTemporaryExpiryRandomFx";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace completeTemporaryItemExpiryTransitionFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one ready temporary item and atomically places its optional expiry output. */
export const completeTemporaryItemExpiryTransitionFx = Effect.fn("completeTemporaryItemExpiryTransitionFx")(function* ({
	itemId,
	runtime,
}: completeTemporaryItemExpiryTransitionFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return yield* Effect.dieMessage(`Temporary item ${itemId} is missing.`);
	if (item.item.type !== ItemEnumSchema.enum.Temporary) {
		return yield* Effect.dieMessage(`Runtime item ${item.id} is not temporary.`);
	}
	if (item.location.scope !== LocationScopeEnumSchema.enum.Board) {
		return yield* Effect.dieMessage(`Temporary item ${item.id} is not on the board.`);
	}
	if (item.remainingDurationMs !== 0) {
		return yield* Effect.dieMessage(`Temporary item ${item.id} is not ready to expire.`);
	}

	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	if (item.item.output === undefined) {
		return {
			expiredItem: item,
			placement: { drop: [] },
			runtime: draft,
		};
	}
	const origin = item.location;
	const configuredOutput = item.item.output;

	const random = yield* makeTemporaryExpiryRandomFx({
		item,
	});
	return yield* Effect.gen(function* () {
		const output = yield* outputFx({
			origin,
			output: configuredOutput,
		});
		if (output.drop.length === 0) {
			return {
				expiredItem: item,
				placement: { drop: [] } satisfies OutputPlacementResultSchema.Type,
				runtime: draft,
			};
		}

		const [placement, withOutput] = yield* applyOutputPlacementFx({
			origin,
			output,
			runtime: draft,
		});
		draft = withOutput;

		return {
			expiredItem: item,
			placement,
			runtime: draft,
		};
	}).pipe(Effect.withRandom(random));
});
