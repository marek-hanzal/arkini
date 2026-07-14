import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
			item.location.scope === "input" &&
			item.location.ownerItemId === ownerItemId &&
			item.location.lineId === lineId
		);
	});
});
