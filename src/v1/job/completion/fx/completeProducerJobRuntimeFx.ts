import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { placeJobLineOutputFx } from "~/v1/job/completion/fx/placeJobLineOutputFx";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";

/** Completes one persistent producer job through reservation return and ordinary output. */
export const completeProducerJobRuntimeFx = Effect.fn("completeProducerJobRuntimeFx")(function* (
	context: JobCompletionContext<"producer">,
) {
	const released = yield* releaseJobReservationsFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: context.runtime,
	});

	return yield* placeJobLineOutputFx({
		line: context.line,
		owner: context.owner,
		runtime: released,
	});
});
