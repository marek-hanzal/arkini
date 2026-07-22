import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace isolateStatefulOwnerFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Keeps one state-owning board identity and standard-places every excess pure quantity. */
export const isolateStatefulOwnerFx = Effect.fn("isolateStatefulOwnerFx")(function* (
	props: isolateStatefulOwnerFx.Props,
) {
	const transition = yield* isolateStatefulOwnerTransitionFx(props);
	return transition.runtime;
});
