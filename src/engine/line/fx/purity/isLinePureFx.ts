import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isLineInputPureFx } from "./isLineInputPureFx";
import { isLineJobPureFx } from "./isLineJobPureFx";
import { isLineQueuePureFx } from "./isLineQueuePureFx";

export namespace isLinePureFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live line owns no identity-bound runtime state. */
export const isLinePureFx = Effect.fn("isLinePureFx")(function* (props: isLinePureFx.Props) {
	const inputPure = yield* isLineInputPureFx(props);
	const jobPure = yield* isLineJobPureFx(props);
	const queuePure = yield* isLineQueuePureFx(props);

	return inputPure && jobPure && queuePure;
});
