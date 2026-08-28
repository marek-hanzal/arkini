import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DefaultLineQueueUnavailableError } from "~/engine/job/error/DefaultLineQueueUnavailableError";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readEffectiveDefaultLineFx } from "~/engine/line/read/readEffectiveDefaultLineFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const ownerItem = Option.getOrUndefined(yield* isLineOwnerItemFx(owner.item));
	if (ownerItem === undefined) {
		return yield* Effect.fail(
			new DefaultLineQueueUnavailableError({
				ownerItemId,
			}),
		);
	}
	const line = yield* readEffectiveDefaultLineFx({
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
