import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { completeTemporaryItemExpiryTransitionFx } from "~/engine/item/temporary/fx/completeTemporaryItemExpiryTransitionFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace completeTemporaryItemExpiryFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Removes one ready temporary item and returns only the committed runtime. */
export const completeTemporaryItemExpiryFx = Effect.fn("completeTemporaryItemExpiryFx")(
	function* (props: completeTemporaryItemExpiryFx.Props) {
		const transition = yield* completeTemporaryItemExpiryTransitionFx(props);
		return transition.runtime;
	},
);
