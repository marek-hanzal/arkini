import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace placeCraftOwnerRemainderFx {
	export interface Props {
		context: JobCompletionContext<"craft">;
		quantity: number;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns a detached craft-stack remainder through the standard drop-placement path. */
export const placeCraftOwnerRemainderFx = Effect.fn("placeCraftOwnerRemainderFx")(function* ({
	context,
	quantity,
	runtime,
}: placeCraftOwnerRemainderFx.Props) {
	if (quantity === 0) return runtime;

	const [, nextRuntime] = yield* applyOutputPlacementFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		output: {
			drop: [
				{
					itemId: context.owner.item.id,
					quantity,
					placement: "drop",
				},
			],
		},
		runtime,
	});

	return nextRuntime;
});
