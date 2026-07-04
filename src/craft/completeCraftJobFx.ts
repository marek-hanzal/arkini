import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { blockedCraftCompletionRetryDelayMs } from "~/craft/craftCompletionTiming";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

type CraftCompletionTarget = {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
	recipe: GameCraftRecipeDefinition;
};

class CraftJobCompletionScopeFx extends Context.Tag("CraftJobCompletionScopeFx")<
	CraftJobCompletionScopeFx,
	completeCraftJobFx.Props
>() {
	//
}

const createCraftCompletedResult = ({
	fromItemId,
	liveJob,
	nowMs,
	recipe,
	save,
}: {
	fromItemId: string;
	liveJob: GameSaveCraftJob;
	nowMs: number;
	recipe: GameCraftRecipeDefinition;
	save: GameSave;
}): GameEngineCompletionResult => ({
	events: [
		{
			atMs: nowMs,
			jobId: liveJob.id,
			recipeId: liveJob.recipeId,
			targetItemInstanceId: liveJob.targetItemInstanceId,
			type: "craft.completed" as const,
		},
		{
			atMs: nowMs,
			fromItemId,
			itemInstanceId: liveJob.targetItemInstanceId,
			reason: "craft-result" as const,
			toItemId: recipe.resultItemId,
			type: "item.replaced" as const,
		},
	],
	save,
	type: "completed" as const,
});

const createMissingCraftJobResult = ({ save }: { save: GameSave }): GameEngineCompletionResult => ({
	events: [],
	save,
	type: "completed" as const,
});

const createCraftFailedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) => ({
	atMs: nowMs,
	jobId: job.id,
	reason,
	recipeId: job.recipeId,
	targetItemInstanceId: job.targetItemInstanceId,
	type: "craft.failed" as const,
});

const createCraftBlockedEvent = ({
	job,
	nowMs,
	reason,
}: {
	job: GameSaveCraftJob;
	nowMs: number;
	reason: GamePlacementFailureReason;
}) => ({
	atMs: nowMs,
	jobId: job.id,
	reason,
	recipeId: job.recipeId,
	targetItemInstanceId: job.targetItemInstanceId,
	type: "craft.blocked" as const,
});

const readLiveCraftJobFx = Effect.fn("completeCraftJobFx.readLiveCraftJobFx")(function* () {
	const { job, save } = yield* CraftJobCompletionScopeFx;
	return save.craftJobs[job.id];
});

const readCraftCompletionRecipeFx = Effect.fn("completeCraftJobFx.readCraftCompletionRecipeFx")(
	function* ({ liveJob }: { liveJob: GameSaveCraftJob }) {
		const { config } = yield* CraftJobCompletionScopeFx;
		const recipe = readCraftRecipeDefinition({
			config,
			recipeId: liveJob.recipeId,
		});
		if (recipe) return recipe;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing craft recipe "${liveJob.recipeId}".`),
		);
	},
);

const readCraftCompletionBoardItemFx = Effect.fn(
	"completeCraftJobFx.readCraftCompletionBoardItemFx",
)(function* ({ liveJob }: { liveJob: GameSaveCraftJob }) {
	const { save } = yield* CraftJobCompletionScopeFx;
	const liveTarget = save.board.items[liveJob.targetItemInstanceId];
	if (liveTarget) return liveTarget;

	return yield* Effect.fail(
		GameEngineError.saveInvalid(
			`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" is missing.`,
		),
	);
});

const assertCraftCompletionTargetMatchesRecipeFx = Effect.fn(
	"completeCraftJobFx.assertCraftCompletionTargetMatchesRecipeFx",
)(function* ({
	liveJob,
	liveTarget,
}: {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
}) {
	if (liveTarget.itemId === liveJob.recipeId) return;

	return yield* Effect.fail(
		GameEngineError.saveInvalid(
			`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" no longer matches recipe "${liveJob.recipeId}".`,
		),
	);
});

const assertCraftResultItemExistsFx = Effect.fn("completeCraftJobFx.assertCraftResultItemExistsFx")(
	function* ({ recipe }: { recipe: GameCraftRecipeDefinition }) {
		const { config } = yield* CraftJobCompletionScopeFx;
		if (config.items[recipe.resultItemId]) return;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing craft result item "${recipe.resultItemId}".`,
			),
		);
	},
);

const readCraftCompletionTargetFx = Effect.fn("completeCraftJobFx.readCraftCompletionTargetFx")(
	function* ({ liveJob }: { liveJob: GameSaveCraftJob }) {
		const recipe = yield* readCraftCompletionRecipeFx({
			liveJob,
		});
		const liveTarget = yield* readCraftCompletionBoardItemFx({
			liveJob,
		});
		yield* assertCraftCompletionTargetMatchesRecipeFx({
			liveJob,
			liveTarget,
		});
		yield* assertCraftResultItemExistsFx({
			recipe,
		});
		return {
			liveJob,
			liveTarget,
			recipe,
		} satisfies CraftCompletionTarget;
	},
);

const readCraftCompletionBlockedReasonFx = Effect.fn(
	"completeCraftJobFx.readCraftCompletionBlockedReasonFx",
)(function* ({ recipe }: CraftCompletionTarget) {
	const { config, save } = yield* CraftJobCompletionScopeFx;
	if (
		!isItemStorageAllowed({
			config,
			itemId: recipe.resultItemId,
			location: "board",
		})
	) {
		return "storage:inventory-forbidden" satisfies GamePlacementFailureReason;
	}

	const targetIgnoredIds = new Set([
		(yield* CraftJobCompletionScopeFx).job.targetItemInstanceId,
	]);
	const remainingCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		ignoredBoardItemInstanceIds: targetIgnoredIds,
		itemId: recipe.resultItemId,
		save,
	});
	return remainingCapacity <= 0
		? ("board:max-count" satisfies GamePlacementFailureReason)
		: undefined;
});

const createFailedCraftCompletionFx = Effect.fn("completeCraftJobFx.createFailedCraftCompletionFx")(
	function* ({ job, reason }: { job: GameSaveCraftJob; reason: GamePlacementFailureReason }) {
		const { nowMs, save } = yield* CraftJobCompletionScopeFx;
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		delete nextSave.craftJobs[job.id];
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				createCraftFailedEvent({
					job,
					nowMs,
					reason,
				}),
			],
			save: nextSave,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	},
);

const createRetryingCraftCompletionFx = Effect.fn(
	"completeCraftJobFx.createRetryingCraftCompletionFx",
)(function* ({ job, reason }: { job: GameSaveCraftJob; reason: GamePlacementFailureReason }) {
	const { nowMs, save } = yield* CraftJobCompletionScopeFx;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextAttemptAtMs = nowMs + blockedCraftCompletionRetryDelayMs;
	nextSave.craftJobs[job.id] = {
		...job,
		delivery: {
			lastBlockedAtMs: nowMs,
			nextAttemptAtMs,
		},
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events:
			job.delivery?.lastBlockedAtMs === undefined
				? [
						createCraftBlockedEvent({
							job,
							nowMs,
							reason,
						}),
					]
				: [],
		save: nextSave,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

const completeBlockedCraftJobFx = Effect.fn("completeCraftJobFx.completeBlockedCraftJobFx")(
	function* ({ job, reason }: { job: GameSaveCraftJob; reason: GamePlacementFailureReason }) {
		return yield* match(isGamePlacementFailureRetryable(reason))
			.with(false, () =>
				createFailedCraftCompletionFx({
					job,
					reason,
				}),
			)
			.with(true, () =>
				createRetryingCraftCompletionFx({
					job,
					reason,
				}),
			)
			.exhaustive();
	},
);

const applyCraftCompletionResultFx = Effect.fn("completeCraftJobFx.applyCraftCompletionResultFx")(
	function* ({ liveJob, liveTarget, recipe }: CraftCompletionTarget) {
		const { config, nowMs, save } = yield* CraftJobCompletionScopeFx;
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const nextTarget = nextSave.board.items[liveJob.targetItemInstanceId];
		if (!nextTarget) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Craft job "${liveJob.id}" target "${liveJob.targetItemInstanceId}" disappeared during completion.`,
				),
			);
		}

		delete nextSave.craftJobs[liveJob.id];
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: liveJob.targetItemInstanceId,
			save: nextSave,
		});
		if (config.items[recipe.resultItemId]?.effects?.length) {
			nextTarget.createdAtMs = nowMs;
		} else {
			delete nextTarget.createdAtMs;
		}
		nextTarget.itemId = recipe.resultItemId;
		nextSave.updatedAtMs = nowMs;

		return createCraftCompletedResult({
			fromItemId: liveTarget.itemId,
			liveJob,
			nowMs,
			recipe,
			save: nextSave,
		});
	},
);

const completeLiveCraftJobFx = Effect.fn("completeCraftJobFx.completeLiveCraftJobFx")(function* ({
	liveJob,
}: {
	liveJob: GameSaveCraftJob;
}) {
	const target = yield* readCraftCompletionTargetFx({
		liveJob,
	});
	const blockedReason = yield* readCraftCompletionBlockedReasonFx(target);
	if (blockedReason) {
		return yield* completeBlockedCraftJobFx({
			job: target.liveJob,
			reason: blockedReason,
		});
	}
	return yield* applyCraftCompletionResultFx(target);
});

const completeCraftJobProgramFx = Effect.fn("completeCraftJobFx.completeCraftJobProgramFx")(
	function* () {
		const { save } = yield* CraftJobCompletionScopeFx;
		const liveJob = yield* readLiveCraftJobFx();
		if (!liveJob) {
			return createMissingCraftJobResult({
				save,
			});
		}
		return yield* completeLiveCraftJobFx({
			liveJob,
		});
	},
);

export const completeCraftJobFx = Effect.fn("completeCraftJobFx")(function* ({
	config,
	job,
	nowMs,
	save,
}: completeCraftJobFx.Props) {
	return yield* completeCraftJobProgramFx().pipe(
		Effect.provideService(CraftJobCompletionScopeFx, {
			config,
			job,
			nowMs,
			save,
		}),
	);
});
