import { Effect } from "effect";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";

export namespace planBestEffortDropPlacementFx {
	export interface Discarded {
		readonly itemUid: string;
		readonly quantity: number;
		readonly reason: PlacementUnavailableError.Reason;
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
	origin,
	runtime,
}: {
	readonly drop: ResolvedOutcome.Item;
	readonly origin: BoardLocationSchema.Type;
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
			origin,
			runtime,
		}).pipe(
			Effect.map((plan) => ({
				type: "placed" as const,
				plan,
			})),
			Effect.catchTag("PlacementUnavailableError", (error) =>
				Effect.succeed({
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
		const lost = Math.min(quantity, attempt.error.remainingQuantity);
		discarded.push({
			itemUid: drop.itemUid,
			quantity: lost,
			reason: attempt.error.reason,
		});
		quantity -= lost;
	}
	return {
		plan: {
			spawn: [],
		},
		discarded,
	} satisfies planBestEffortDropPlacementFx.Result;
});
