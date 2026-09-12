import { Effect } from "effect";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";

/** Enforces player control at command admission; never gates autonomous runtime operations. */
export const assertItemProductionPlayerControlFx = Effect.fn("assertItemProductionPlayerControlFx")(
	function* ({
		ownerItemId,
		runtime,
	}: {
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		if (!canControlItemProductionFn(owner.item))
			return yield* Effect.fail(
				new ItemProductionControlUnavailableError({
					ownerItemId,
					reason: "automatic-only",
				}),
			);
	},
);
