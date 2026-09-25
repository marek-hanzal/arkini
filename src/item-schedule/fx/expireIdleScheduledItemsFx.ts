import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { Effect } from "effect";
import { attemptScheduledItemExpiryFx } from "~/item-schedule/fx/attemptScheduledItemExpiryFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** Settles exhausted identities in stable order after accepted work has had its dispatch pass. */
export const expireIdleScheduledItemsFx = Effect.fn("expireIdleScheduledItemsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	let draft = runtime;
	const facts: EngineFact[] = [];
	const claimedSourceItemIds = new Set<IdSchema.Type>();
	const ids = runtime.items
		.filter((item) => item.schedule?.remainingDurationMs === 0)
		.map((item) => item.id)
		.sort();
	for (const itemId of ids) {
		const item = draft.items.find((candidate) => candidate.id === itemId);
		const expiryLineUids = new Set(
			item?.item.lines
				.filter((line) => line.clock === LineClockModeEnumSchema.enum["clock-lifetime"])
				.map((line) => line.uid) ?? [],
		);
		if (
			item === undefined ||
			draft.jobs.some(
				(job) => job.ownerItemId === itemId && expiryLineUids.has(job.lineUid),
			) ||
			draft.jobQueue.some(
				(request) => request.ownerItemId === itemId && expiryLineUids.has(request.lineUid),
			) ||
			(readItemScheduleFn(item.item)?.expiryMode !== "kill-switch" &&
				draft.jobs.some((job) => job.ownerItemId === itemId))
		)
			continue;
		const attempt = yield* attemptScheduledItemExpiryFx({
			itemId,
			runtime: draft,
			excludedSourceItemIds: claimedSourceItemIds,
		});
		if (attempt.type === "blocked") continue;
		draft = attempt.runtime;
		facts.push(...attempt.facts);
		for (const sourceItemId of attempt.claimedSourceItemIds)
			claimedSourceItemIds.add(sourceItemId);
	}
	return {
		runtime: draft,
		facts,
	};
});
