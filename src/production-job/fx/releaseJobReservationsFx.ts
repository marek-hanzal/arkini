import { placeRuntimeItemBestEffortFx } from "~/item-placement/fx/placeRuntimeItemBestEffortFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { placeRuntimeItemFx } from "~/item-placement/fx/placeRuntimeItemFx";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace releaseJobReservationsFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		originItemId: IdSchema.Type;
		reservations: readonly ReservedRuntimeItemSchema.Type[];
		overflow?: "discard";
		runtime: RuntimeSchema.Type;
	}
}

/** Returns the same reserved instances through canonical placement with exact visible facts. */
export const releaseJobReservationsFx = Effect.fn("releaseJobReservationsFx")(function* ({
	origin,
	originItemId,
	reservations,
	runtime,
	overflow,
}: releaseJobReservationsFx.Props) {
	return yield* Effect.reduce(
		reservations,
		() => ({
			events: [] as GameEventSchema.Type[],
			runtime,
		}),
		(state, reservation) =>
			Effect.gen(function* () {
				const placement = yield* overflow === "discard"
					? placeRuntimeItemBestEffortFx({
							itemId: reservation.id,
							origin,
							originItemId,
							runtime: state.runtime,
							source: "reservation",
						})
					: placeRuntimeItemFx({
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
