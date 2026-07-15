import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { placeRuntimeItemFx } from "~/v1/placement/fx/placeRuntimeItemFx";
import type { ReservedRuntimeItemSchema } from "~/v1/runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace releaseJobReservationsFx {
	export interface Props {
		origin: PositionSchema.Type;
		reservations: readonly ReservedRuntimeItemSchema.Type[];
		runtime: RuntimeSchema.Type;
	}
}

/** Returns the same reserved runtime instances through canonical existing-item placement. */
export const releaseJobReservationsFx = Effect.fn("releaseJobReservationsFx")(function* ({
	origin,
	reservations,
	runtime,
}: releaseJobReservationsFx.Props) {
	return yield* Effect.reduce(reservations, runtime, (draft, reservation) => {
		return placeRuntimeItemFx({
			itemId: reservation.id,
			origin,
			runtime: draft,
		});
	});
});
