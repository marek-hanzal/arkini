import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readEffectiveLineFn {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerItem: narrowLineOwnerItemFn.Result;
		readonly runtime: Pick<RuntimeSchema.Type, "defaultLineByOwnerItemId" | "items">;
		readonly selection: "default" | "clock";
	}

	export type Result = LineSchema.Type | undefined;
}

/**
 * Resolves one exact owner's runtime override before the immutable authored fallback.
 *
 * A present `null` override deliberately disables the fallback. Invalid persisted
 * line IDs do not silently fall back; runtime validation owns reporting that stale state.
 */
export const readEffectiveLineFn = ({
	ownerItemId,
	ownerItem,
	runtime,
	selection,
}: readEffectiveLineFn.Props) => {
	const lines = readLineOwnerLinesFn(ownerItem);
	const override =
		selection === "default"
			? Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId)
				? runtime.defaultLineByOwnerItemId[ownerItemId]
				: undefined
			: runtime.items.find((item) => item.id === ownerItemId)?.schedule?.lineId;
	if (override !== undefined) {
		return override === null ? undefined : lines.find((line) => line.id === override);
	}
	return lines.find((line) => line[selection]);
};
