import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readEffectiveDefaultLineFn {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerItem: isLineOwnerItemFn.Result;
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
export const readEffectiveDefaultLineFn = ({
	ownerItemId,
	ownerItem,
	runtime,
}: readEffectiveDefaultLineFn.Props) => {
	const lines = readLineOwnerLinesFn(ownerItem);
	if (Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId)) {
		const override = runtime.defaultLineByOwnerItemId[ownerItemId];
		return override === null ? undefined : lines.find((line) => line.id === override);
	}
	return lines.find((line) => line.default);
};
