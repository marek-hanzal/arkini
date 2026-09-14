import { Effect } from "effect";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { dropFx } from "~/production-output/fx/dropFx";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";

export namespace planBestEffortDropPlacementFx {
	export interface Discarded {
		readonly itemId: string;
		readonly quantity: number;
		readonly reason: Exclude<PlacementUnavailableError.Reason, "board:origin-unavailable">;
	}
	export interface Result {
		readonly plan: PlacementPlan;
		readonly discarded: readonly Discarded[];
	}
}

/** Plans the largest fitting quantity; only explicit capacity rejection permits loss.
 * No candidate is published here. The caller commits placement and loss facts together. */
export const planBestEffortDropPlacementFx = Effect.fn("planBestEffortDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
	runtime,
}: {
	readonly drop: dropFx.Result;
	readonly excludedLocations?: readonly GridLocationSchema.Type[];
	readonly origin: GridLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	let quantity = drop.quantity;
	const discarded: planBestEffortDropPlacementFx.Discarded[] = [];
	while (quantity > 0) {
		const attempt = yield* planDropPlacementFx({
			drop: {
				...drop,
				quantity,
			},
			excludedLocations,
			origin,
			runtime,
		}).pipe(
			Effect.map((plan) => ({
				type: "placed" as const,
				plan,
			})),
			Effect.catchTag("PlacementUnavailableError", (error) =>
				error.reason === PlacementUnavailableError.Reason.BoardOriginUnavailable
					? Effect.fail(error)
					: Effect.succeed({
							type: "blocked" as const,
							error,
						}),
			),
		);
		if (attempt.type === "placed")
			return {
				plan: attempt.plan,
				discarded,
			} satisfies planBestEffortDropPlacementFx.Result;
		if (attempt.error.reason === PlacementUnavailableError.Reason.BoardOriginUnavailable)
			return yield* Effect.fail(attempt.error);
		const lost = Math.min(quantity, attempt.error.remainingQuantity);
		discarded.push({
			itemId: drop.itemId,
			quantity: lost,
			reason: attempt.error.reason,
		});
		quantity -= lost;
	}
	return {
		plan: {
			remove: [],
			spawn: [],
			stack: [],
		},
		discarded,
	} satisfies planBestEffortDropPlacementFx.Result;
});
