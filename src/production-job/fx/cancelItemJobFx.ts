import { Effect } from "effect";

import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";

export namespace cancelItemJobFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly jobId: IdSchema.Type;
	}
}

/** Cancels only the displayed job; completion or replacement before admission makes the click a no-op. */
export const cancelItemJobFx = Effect.fn("cancelItemJobFx")(function* ({
	ownerItemId,
	jobId,
}: cancelItemJobFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const job = runtime.jobs.find(
				(candidate) => candidate.id === jobId && candidate.ownerItemId === ownerItemId,
			);
			if (job === undefined)
				return [
					undefined,
					runtime,
				] as const;
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
			const aborted = yield* abortJobRuntimeFx({
				jobId,
				reason: "player-cancelled",
				runtime,
			});
			return [
				undefined,
				aborted.runtime,
				aborted.facts,
			] as const;
		}),
	);
});
