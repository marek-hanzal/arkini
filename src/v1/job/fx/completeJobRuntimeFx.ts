import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type {
	JobCompletionContext,
	JobCompletionOwner,
} from "~/v1/job/completion/JobCompletionContext";
import { completeBlueprintJobRuntimeFx } from "~/v1/job/completion/fx/completeBlueprintJobRuntimeFx";
import { completeCraftJobRuntimeFx } from "~/v1/job/completion/fx/completeCraftJobRuntimeFx";
import { completeProducerJobRuntimeFx } from "~/v1/job/completion/fx/completeProducerJobRuntimeFx";
import { completeStashJobRuntimeFx } from "~/v1/job/completion/fx/completeStashJobRuntimeFx";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { JobNotFoundError } from "~/v1/job/error/JobNotFoundError";
import { JobNotReadyError } from "~/v1/job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/v1/job/random/makeJobCompletionRandomFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace completeJobRuntimeFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves one ready job once and dispatches its atomic owner-specific completion branch. */
export const completeJobRuntimeFx = Effect.fn("completeJobRuntimeFx")(function* ({
	jobId,
	runtime,
}: completeJobRuntimeFx.Props) {
	const job = runtime.jobs.find((candidate) => candidate.id === jobId);
	if (job === undefined)
		return yield* Effect.fail(
			new JobNotFoundError({
				jobId,
			}),
		);
	if (job.remainingMs !== 0)
		return yield* Effect.fail(
			new JobNotReadyError({
				jobId: job.id,
				remainingMs: job.remainingMs,
			}),
		);

	const owner = runtime.items.find((item) => item.id === job.ownerItemId);
	if (owner === undefined) return yield* Effect.dieMessage(`Job ${job.id} owner is missing.`);
	if (!isBoardRuntimeItem(owner))
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	const line = yield* readItemLineFx({
		item: owner.item,
		lineId: job.lineId,
	});
	if (line === undefined)
		return yield* Effect.dieMessage(`Job ${job.id} line ${job.lineId} is missing.`);
	const reservations = runtime.items.filter(
		(item) => item.location.scope === "job" && item.location.jobId === job.id,
	);
	const completionRuntime = {
		...runtime,
		items: runtime.items.filter((item) => !reservations.includes(item)),
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	const random = yield* makeJobCompletionRandomFx(job);

	return yield* Effect.gen(function* () {
		switch (owner.item.type) {
			case "producer":
				return yield* completeProducerJobRuntimeFx({
					job,
					line,
					owner: owner as JobCompletionOwner<"producer">,
					reservations,
					runtime: completionRuntime,
				} satisfies JobCompletionContext<"producer">);
			case "craft":
				return yield* completeCraftJobRuntimeFx({
					job,
					line,
					owner: owner as JobCompletionOwner<"craft">,
					reservations,
					runtime: completionRuntime,
				} satisfies JobCompletionContext<"craft">);
			case "blueprint":
				return yield* completeBlueprintJobRuntimeFx({
					job,
					line,
					owner: owner as JobCompletionOwner<"blueprint">,
					reservations,
					runtime: completionRuntime,
				} satisfies JobCompletionContext<"blueprint">);
			case "stash":
				return yield* completeStashJobRuntimeFx({
					job,
					line,
					owner: owner as JobCompletionOwner<"stash">,
					reservations,
					runtime: completionRuntime,
				} satisfies JobCompletionContext<"stash">);
			default:
				return yield* Effect.dieMessage(
					`Job ${job.id} owner ${owner.id} has unsupported completion type ${owner.item.type}.`,
				);
		}
	}).pipe(Effect.withRandom(random));
});
