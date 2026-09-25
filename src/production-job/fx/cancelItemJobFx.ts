import { Effect } from "effect";

import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import { attemptTerminalItemFx } from "~/item-terminal/fx/attemptTerminalItemFx";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";

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
			const aborted = yield* abortJobRuntimeFx({
				jobId,
				reason: "player-cancelled",
				runtime,
			});
			const owner = aborted.runtime.items.find((item) => item.id === ownerItemId);
			const terminal =
				owner === undefined || readItemTerminalStateFn(owner) === undefined
					? undefined
					: yield* attemptTerminalItemFx({
							itemId: ownerItemId,
							runtime: aborted.runtime,
						});
			if (terminal?.type === "blocked") return yield* Effect.fail(terminal.error);
			return [
				undefined,
				terminal?.runtime ?? aborted.runtime,
				[
					...aborted.facts,
					...(terminal?.facts ?? []),
				],
			] as const;
		}),
	);
});
