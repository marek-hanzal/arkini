import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";

/**
 * Completes the currently supported blueprint job behavior.
 *
 * Target replacement and blueprint-owned additional output remain task 02. This explicit
 * branch prevents those semantics from leaking into producer or craft completion.
 */
export const completeBlueprintJobRuntimeFx = Effect.fn("completeBlueprintJobRuntimeFx")(function* (
	context: JobCompletionContext<"blueprint">,
) {
	return yield* releaseJobReservationsFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: context.runtime,
	});
});
