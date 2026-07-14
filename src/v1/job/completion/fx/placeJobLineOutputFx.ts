import { Effect } from "effect";

import type { LineSchema } from "~/v1/line/schema/LineSchema";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace placeJobLineOutputFx {
	export interface Props {
		line: LineSchema.Type;
		owner: BoardRuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves and places one ordinary line output from its live board owner. */
export const placeJobLineOutputFx = Effect.fn("placeJobLineOutputFx")(function* ({
	line,
	owner,
	runtime,
}: placeJobLineOutputFx.Props) {
	if (line.output === undefined) return runtime;

	const output = yield* outputFx({
		origin: owner.location.position,
		output: line.output,
	});
	const [, nextRuntime] = yield* applyOutputPlacementFx({
		origin: owner.location.position,
		originItemId: owner.id,
		output,
		runtime,
	});

	return nextRuntime;
});
