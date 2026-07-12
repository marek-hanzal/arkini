import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveLineStartFx } from "~/v1/job/fx/read/resolveLineStartFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";

export namespace readLineStartFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}

/** Reads the current declarative line-start state from one runtime snapshot. */
export const readLineStartFx = Effect.fn("readLineStartFx")(function* ({
	ownerItemId,
	lineId,
}: readLineStartFx.Props) {
	const runtime = yield* readRuntimeFx();
	return yield* resolveLineStartFx({
		ownerItemId,
		lineId,
		runtime,
	});
});
