import { Effect } from "effect";
import { attemptTerminalItemFx } from "~/item-terminal/fx/attemptTerminalItemFx";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import type { IdSchema } from "~/game-value/schema/IdSchema";

/** Settles zero-unit and exhausted-lifetime identities after accepted work's completion pass. */
export const settleTerminalItemsFx = Effect.fn("settleTerminalItemsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	let draft = runtime;
	const facts: EngineFact[] = [];
	const claimedSourceItemIds = new Set<IdSchema.Type>();
	const ids = runtime.items
		.filter((item) => readItemTerminalStateFn(item) !== undefined)
		.map((item) => item.id)
		.sort();
	for (const itemId of ids) {
		const item = draft.items.find((candidate) => candidate.id === itemId);
		if (item === undefined) continue;
		const terminal = readItemTerminalStateFn(item);
		if (terminal === undefined) continue;
		const terminalLineUids = new Set(
			item.item.lines
				.filter((line) => line.trigger === "item-termination")
				.map((line) => line.uid),
		);
		if (
			draft.jobs.some(
				(job) => job.ownerItemId === itemId && terminalLineUids.has(job.lineUid),
			) ||
			draft.jobQueue.some(
				(request) =>
					request.ownerItemId === itemId && terminalLineUids.has(request.lineUid),
			)
		)
			continue;
		if (terminal.mode !== "kill-switch" && draft.jobs.some((job) => job.ownerItemId === itemId))
			continue;
		const attempt = yield* attemptTerminalItemFx({
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
