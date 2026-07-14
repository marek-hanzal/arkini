import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace releaseJobReservationsFx {
	export interface Props {
		origin: PositionSchema.Type;
		reservations: readonly RuntimeItemSchema.Type[];
		runtime: RuntimeSchema.Type;
	}
}

/** Returns detached job reservations through the ordinary drop-placement path. */
export const releaseJobReservationsFx = Effect.fn("releaseJobReservationsFx")(function* ({
	origin,
	reservations,
	runtime,
}: releaseJobReservationsFx.Props) {
	let draft = runtime;
	for (const reservation of reservations) {
		const plan = yield* planDropPlacementFx({
			drop: {
				itemId: reservation.item.id,
				quantity: reservation.quantity,
				placement: "drop",
			},
			origin,
			runtime: draft,
		});
		const [, nextDraft] = yield* applyPlacementPlanFx({
			plan,
			runtime: draft,
		});
		draft = nextDraft;
	}

	return draft;
});
