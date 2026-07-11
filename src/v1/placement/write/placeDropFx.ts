import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { dropFx } from "~/v1/output/fx/dropFx";
import type { DropSchema } from "~/v1/output/schema/DropSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { readPlacementOriginFx } from "~/v1/placement/fx/readPlacementOriginFx";
import type { DropPlacementResolutionSchema } from "~/v1/placement/schema/DropPlacementResolutionSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";

export namespace placeDropFx {
	export interface Props {
		drop: DropSchema.Type;
		originItemId: IdSchema.Type;
	}
}

/**
 * Atomically resolves and places one configured drop from the latest runtime snapshot.
 */
export const placeDropFx = Effect.fn("placeDropFx")(function* ({
	drop,
	originItemId,
}: placeDropFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const origin = yield* readPlacementOriginFx({
				originItemId,
				runtime,
			});
			const resolved = yield* dropFx({
				drop,
				origin: origin.location.position,
			});
			if (resolved === undefined) {
				return [
					undefined satisfies DropPlacementResolutionSchema.Type,
					runtime,
				] as const;
			}

			const [output, nextRuntime] = yield* applyOutputPlacementFx({
				origin: origin.location.position,
				originItemId,
				output: {
					drop: [
						resolved,
					],
				},
				runtime,
			});

			return [
				output.drop[0] satisfies DropPlacementResolutionSchema.Type,
				nextRuntime,
			] as const;
		});
	});
});
