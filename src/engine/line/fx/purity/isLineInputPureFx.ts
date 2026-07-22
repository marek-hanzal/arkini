import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace isLineInputPureFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live line owns no buffered input items. */
export const isLineInputPureFx = Effect.fn("isLineInputPureFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: isLineInputPureFx.Props) {
	return !runtime.items.some((item) => {
		return (
			item.location.scope === LocationScopeEnumSchema.enum.Input &&
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId
		);
	});
});
