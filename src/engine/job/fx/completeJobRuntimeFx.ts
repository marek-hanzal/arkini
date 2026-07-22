import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { completeJobTransitionFx } from "~/engine/job/fx/completeJobTransitionFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace completeJobRuntimeFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one ready job and returns only its committed runtime for internal callers and tests. */
export const completeJobRuntimeFx = Effect.fn("completeJobRuntimeFx")(function* (
	props: completeJobRuntimeFx.Props,
) {
	const transition = yield* completeJobTransitionFx(props);
	return transition.runtime;
});
