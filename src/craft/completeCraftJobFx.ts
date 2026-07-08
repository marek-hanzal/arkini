import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { applyCraftCompletionResultFx } from "~/craft/applyCraftCompletionResultFx";
import { completeBlockedCraftJobFx } from "~/craft/completeBlockedCraftJobFx";
import { createMissingCraftJobResult } from "~/craft/CraftJobCompletionEvents";
import { readCraftCompletionTargetFx } from "~/craft/readCraftCompletionTargetFx";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

const completeLiveCraftJobFx = Effect.fn("completeCraftJobFx.completeLiveCraftJobFx")(function* ({
	config,
	liveJob,
	nowMs,
	save,
}: {
	config: GameConfig;
	liveJob: GameSaveCraftJob;
	nowMs: number;
	save: GameSave;
}) {
	const target = yield* readCraftCompletionTargetFx({
		config,
		liveJob,
		save,
	});
	const resultEither = yield* Effect.either(
		applyCraftCompletionResultFx({
			config,
			nowMs,
			save,
			target,
		}),
	);
	if (resultEither._tag === "Right") return resultEither.right;
	if (resultEither.left._tag !== "GamePlacementFailed")
		return yield* Effect.fail(resultEither.left);
	return yield* completeBlockedCraftJobFx({
		job: target.liveJob,
		nowMs,
		reason: resultEither.left.reason,
		save,
	});
});

export const completeCraftJobFx = Effect.fn("completeCraftJobFx")(function* ({
	config,
	job,
	nowMs,
	save,
}: completeCraftJobFx.Props) {
	const liveJob = save.craftJobs[job.id];
	if (!liveJob) {
		return createMissingCraftJobResult({
			save,
		});
	}

	return yield* completeLiveCraftJobFx({
		config,
		liveJob,
		nowMs,
		save,
	});
});
