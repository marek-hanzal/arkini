import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/v1/runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { makeTemporaryExpiryRandomFx } from "~/v1/item/temporary/random/makeTemporaryExpiryRandomFx";

export namespace completeTemporaryItemExpiryFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one ready temporary item and atomically places its optional expiry output. */
export const completeTemporaryItemExpiryFx = Effect.fn("completeTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: completeTemporaryItemExpiryFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return yield* Effect.dieMessage(`Temporary item ${itemId} is missing.`);
	if (item.item.type !== "temporary") {
		return yield* Effect.dieMessage(`Runtime item ${item.id} is not temporary.`);
	}
	if (item.location.scope !== "board") {
		return yield* Effect.dieMessage(`Temporary item ${item.id} is not on the board.`);
	}
	if (item.remainingDurationMs !== 0) {
		return yield* Effect.dieMessage(`Temporary item ${item.id} is not ready to expire.`);
	}

	let draft: RuntimeSchema.Type = yield* removeRuntimeItemIdentityFx({
		item,
		runtime,
	});
	if (item.item.output === undefined) return draft;
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
		if (output.drop.length === 0) return draft;

		const [, withOutput] = yield* applyOutputPlacementFx({
			origin,
			output,
			runtime: draft,
		});
		draft = withOutput;

		return draft;
	}).pipe(Effect.withRandom(random));
});
