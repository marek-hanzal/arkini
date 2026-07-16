import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { resolveLineRunFx } from "./resolveLineRunFx";

export namespace readLineRunFx {
	export interface Props {
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
	}
}

/**
 * Reads one current line-run preview from the live runtime.
 *
 * This preview is not a write authorization. A future start command must accept
 * only identifiers and recompute the plan inside its atomic runtime transaction.
 */
export const readLineRunFx = Effect.fn("readLineRunFx")(function* ({
	lineId,
	ownerItemId,
}: readLineRunFx.Props) {
	const runtimeFx = yield* RuntimeFx;
	const runtime = yield* runtimeFx.read;

	return yield* resolveLineRunFx({
		lineId,
		ownerItemId,
		runtime,
	});
});
