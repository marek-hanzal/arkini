import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { DefaultLineQueueUnavailableError } from "~/production-job/error/DefaultLineQueueUnavailableError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readEffectiveDefaultLineFn } from "~/production-line/fn/readEffectiveDefaultLineFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readDefaultLineQueueTargetFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves one exact live owner's current runtime override or authored default line. */
export const readDefaultLineQueueTargetFx = Effect.fn("readDefaultLineQueueTargetFx")(function* ({
	ownerItemId,
	runtime,
}: readDefaultLineQueueTargetFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
	if (ownerItem === undefined) {
		return yield* Effect.fail(
			new DefaultLineQueueUnavailableError({
				ownerItemId,
			}),
		);
	}
	const line = readEffectiveDefaultLineFn({
		ownerItemId,
		ownerItem,
		runtime,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new DefaultLineQueueUnavailableError({
				ownerItemId,
			}),
		);
	}
	return line;
});
