import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { completeJobTransitionFx } from "~/production-job/fx/completeJobTransitionFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace completeJobRuntimeForTestFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Projects the canonical completion transition to runtime-only test fixtures. */
export const completeJobRuntimeForTestFx = Effect.fn("completeJobRuntimeForTestFx")(function* (
	props: completeJobRuntimeForTestFx.Props,
) {
	const transition = yield* completeJobTransitionFx(props);
	return transition.runtime;
});
