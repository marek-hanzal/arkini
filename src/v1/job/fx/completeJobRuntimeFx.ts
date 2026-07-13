import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { JobNotFoundError } from "~/v1/job/error/JobNotFoundError";
import { JobNotReadyError } from "~/v1/job/error/JobNotReadyError";
import { makeJobCompletionRandomFx } from "~/v1/job/random/makeJobCompletionRandomFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace completeJobRuntimeFx {
	export interface Props {
		jobId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves and completes one live ready job as one atomic draft operation. */
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

	const random = yield* makeJobCompletionRandomFx(job);
	return yield* Effect.gen(function* () {
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
		let draft: RuntimeSchema.Type = {
			...runtime,
			items: runtime.items.filter((item) => !reservations.includes(item)),
			jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
		};
		for (const reservation of reservations) {
			const plan = yield* planDropPlacementFx({
				drop: {
					itemId: reservation.item.id,
					quantity: reservation.quantity,
					placement: "drop",
				},
				origin: owner.location.position,
				originItemId: owner.id,
				runtime: draft,
			});
			const [, nextDraft] = yield* applyPlacementPlanFx({
				plan,
				runtime: draft,
			});
			draft = nextDraft;
		}
		if (line.output !== undefined) {
			const output = yield* outputFx({
				origin: owner.location.position,
				output: line.output,
			});
			const [, nextDraft] = yield* applyOutputPlacementFx({
				origin: owner.location.position,
				originItemId: owner.id,
				output,
				runtime: draft,
			});
			draft = nextDraft;
		}
		return draft;
	}).pipe(Effect.withRandom(random));
});
