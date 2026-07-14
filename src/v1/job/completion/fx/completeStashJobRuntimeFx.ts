import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { placeJobLineOutputFx } from "~/v1/job/completion/fx/placeJobLineOutputFx";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";

/**
 * Completes the currently supported stash line behavior.
 *
 * Stash consumption and top-level stash output remain task 03. This branch deliberately
 * preserves the existing line-output behavior until that lifecycle is designed.
 */
export const completeStashJobRuntimeFx = Effect.fn("completeStashJobRuntimeFx")(function* (
	context: JobCompletionContext<"stash">,
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
