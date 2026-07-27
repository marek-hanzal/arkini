import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readEffectiveDefaultLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerItem: isLineOwnerItemFx.Result;
		readonly runtime: Pick<RuntimeSchema.Type, "defaultLineByOwnerItemId">;
	}

	export type Result = LineSchema.Type | undefined;
}

/**
 * Resolves one exact owner's runtime override before the immutable authored fallback.
 *
 * A present `null` override deliberately disables the fallback. Invalid persisted
 * line IDs do not silently fall back; runtime validation owns reporting that stale state.
 */
export const readEffectiveDefaultLineFx = Effect.fn("readEffectiveDefaultLineFx")(function* ({
	ownerItemId,
	ownerItem,
	runtime,
}: readEffectiveDefaultLineFx.Props) {
	const lines = yield* readLineOwnerLinesFx(ownerItem);
	if (Object.hasOwn(runtime.defaultLineByOwnerItemId ?? {}, ownerItemId)) {
		const override = runtime.defaultLineByOwnerItemId?.[ownerItemId];
		return override === null ? undefined : lines.find((line) => line.id === override);
	}
	return lines.find((line) => line.default);
});
