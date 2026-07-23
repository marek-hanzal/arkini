import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import type { ReservedRuntimeItemSchema } from "~/engine/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace releaseJobReservationsFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		originItemId: IdSchema.Type;
		reservations: readonly ReservedRuntimeItemSchema.Type[];
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Returns the same reserved instances through canonical placement with exact visible facts. */
export const releaseJobReservationsFx = Effect.fn("releaseJobReservationsFx")(function* ({
	origin,
	originItemId,
	reservations,
	runtime,
}: releaseJobReservationsFx.Props) {
	return yield* Effect.reduce(
		reservations,
		{
			events: [] as GameEventSchema.Type[],
			runtime,
		},
		(state, reservation) =>
			Effect.gen(function* () {
				const placement = yield* placeRuntimeItemFx({
					itemId: reservation.id,
					origin,
					originItemId,
					runtime: state.runtime,
				});
				return {
					events: [
						...state.events,
						...placement.events,
					],
					runtime: placement.runtime,
				};
			}),
	);
});
