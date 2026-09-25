import { Effect } from "effect";

import type { EngineFact } from "~/game-event/type/EngineFact";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Drops only terminal work before an unrelated removal; other work still blocks removal. */
export const cancelItemTerminationWorkFx = Effect.fn("cancelItemTerminationWorkFx")(function* ({
	itemId,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const owner = runtime.items.find((item) => item.id === itemId);
	if (owner === undefined) return yield* Effect.die(new Error(`Item ${itemId} is missing.`));
	const isTerminationLineFn = (lineUid: IdSchema.Type) =>
		readItemLineFn({
			item: owner.item,
			lineUid,
		})?.trigger === LineTriggerEnumSchema.enum["item-termination"];
	let draft: RuntimeSchema.Type = {
		...runtime,
		jobQueue: runtime.jobQueue.filter(
			(request) => request.ownerItemId !== itemId || !isTerminationLineFn(request.lineUid),
		),
	};
	const facts: EngineFact[] = [];
	for (const job of runtime.jobs.filter(
		(candidate) => candidate.ownerItemId === itemId && isTerminationLineFn(candidate.lineUid),
	)) {
		const aborted = yield* abortJobRuntimeFx({
			jobId: job.id,
			reason: "owner-removed",
			overflow: "discard",
			runtime: draft,
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		);
		draft = aborted.runtime;
		facts.push(...aborted.facts);
	}
	return {
		facts,
		runtime: draft,
	};
});
