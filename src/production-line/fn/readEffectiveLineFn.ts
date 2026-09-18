import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readEffectiveLineFn {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerItem: ItemSchema.Type;
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
export const readEffectiveLineFn = ({
	ownerItemId,
	ownerItem,
	runtime,
}: readEffectiveLineFn.Props) => {
	const lines = ownerItem.lines;
	const override = Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId)
		? runtime.defaultLineByOwnerItemId[ownerItemId]
		: undefined;
	if (override !== undefined) {
		return override === null ? undefined : lines.find((line) => line.id === override);
	}
	return lines.find((line) => line.default);
};
