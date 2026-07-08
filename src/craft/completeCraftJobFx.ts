import { Effect } from "effect";
import { applyCraftCompletionResultFx } from "~/craft/applyCraftCompletionResultFx";
import { completeBlockedCraftJobFx } from "~/craft/completeBlockedCraftJobFx";
import { createMissingCraftJobResult } from "~/craft/CraftJobCompletionEvents";
import type { CraftJobCompletionScope } from "~/craft/CraftJobCompletionTypes";
import { readCraftCompletionTargetFx } from "~/craft/readCraftCompletionTargetFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

const readLiveCraftJobFx = Effect.fn("completeCraftJobFx.readLiveCraftJobFx")(function* (
	scope: CraftJobCompletionScope,
) {
	return scope.save.craftJobs[scope.job.id];
});

const completeLiveCraftJobFx = Effect.fn("completeCraftJobFx.completeLiveCraftJobFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveCraftJob;
	scope: CraftJobCompletionScope;
}) {
	const target = yield* readCraftCompletionTargetFx({
		liveJob,
		scope,
	});
	const resultEither = yield* Effect.either(
		applyCraftCompletionResultFx({
			scope,
			target,
		}),
	);
	if (resultEither._tag === "Right") return resultEither.right;
	if (resultEither.left._tag !== "GamePlacementFailed")
		return yield* Effect.fail(resultEither.left);
	return yield* completeBlockedCraftJobFx({
		job: target.liveJob,
		reason: resultEither.left.reason,
		scope,
	});
});

const completeCraftJobProgramFx = Effect.fn("completeCraftJobFx.completeCraftJobProgramFx")(
	function* (scope: CraftJobCompletionScope) {
		const liveJob = yield* readLiveCraftJobFx(scope);
		if (!liveJob) {
			return createMissingCraftJobResult({
				save: scope.save,
			});
		}
		return yield* completeLiveCraftJobFx({
			liveJob,
			scope,
		});
	},
);

export const completeCraftJobFx = Effect.fn("completeCraftJobFx")(function* (
	props: completeCraftJobFx.Props,
) {
	return yield* completeCraftJobProgramFx(props);
});
