import { Effect } from "effect";
import { match } from "ts-pattern";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import { blockedCraftCompletionRetryDelayMs } from "~/craft/craftCompletionTiming";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { removeCraftJobFromSaveFx } from "~/craft/removeCraftJobFromSaveFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace completeCraftJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveCraftJob;
		nowMs: number;
	}
}

type CraftCompletionScope = completeCraftJobFx.Props;

type CraftCompletionTarget = {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
	recipe: GameCraftRecipeDefinition;
};

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

const readLiveCraftJobFx = Effect.fn("completeCraftJobFx.readLiveCraftJobFx")(function* ({
	job,
	save,
}: CraftCompletionScope) {
	return save.craftJobs[job.id];
});

const readCraftCompletionRecipeFx = Effect.fn("completeCraftJobFx.readCraftCompletionRecipeFx")(
	function* ({ liveJob, scope }: { liveJob: GameSaveCraftJob; scope: CraftCompletionScope }) {
		const recipe = readCraftRecipeDefinition({
			config: scope.config,
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
)(function* ({ liveJob, scope }: { liveJob: GameSaveCraftJob; scope: CraftCompletionScope }) {
	const liveTarget = scope.save.board.items[liveJob.targetItemInstanceId];
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
	function* ({
		recipe,
		scope,
	}: {
		recipe: GameCraftRecipeDefinition;
		scope: CraftCompletionScope;
	}) {
		if (scope.config.items[recipe.resultItemId]) return;

		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing craft result item "${recipe.resultItemId}".`,
			),
		);
	},
);

const readCraftCompletionTargetFx = Effect.fn("completeCraftJobFx.readCraftCompletionTargetFx")(
	function* ({ liveJob, scope }: { liveJob: GameSaveCraftJob; scope: CraftCompletionScope }) {
		const recipe = yield* readCraftCompletionRecipeFx({
			liveJob,
			scope,
		});
		const liveTarget = yield* readCraftCompletionBoardItemFx({
			liveJob,
			scope,
		});
		yield* assertCraftCompletionTargetMatchesRecipeFx({
			liveJob,
			liveTarget,
		});
		yield* assertCraftResultItemExistsFx({
			recipe,
			scope,
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
)(function* ({ scope, target }: { scope: CraftCompletionScope; target: CraftCompletionTarget }) {
	if (
		!isItemStorageAllowed({
			config: scope.config,
			itemId: target.recipe.resultItemId,
			location: "board",
		})
	) {
		return "storage:inventory-forbidden" satisfies GamePlacementFailureReason;
	}

	const targetIgnoredIds = new Set([
		target.liveJob.targetItemInstanceId,
	]);
	const remainingCapacity = yield* readBoardItemMaxCountCapacityFx({
		config: scope.config,
		ignoredBoardItemInstanceIds: targetIgnoredIds,
		itemId: target.recipe.resultItemId,
		save: scope.save,
	});
	return remainingCapacity <= 0
		? ("board:max-count" satisfies GamePlacementFailureReason)
		: undefined;
});

const createFailedCraftCompletionFx = Effect.fn("completeCraftJobFx.createFailedCraftCompletionFx")(
	function* ({
		job,
		reason,
		scope,
	}: {
		job: GameSaveCraftJob;
		reason: GamePlacementFailureReason;
		scope: CraftCompletionScope;
	}) {
		const nextSave = yield* cloneGameSaveFx({
			save: scope.save,
		});
		yield* removeCraftJobFromSaveFx({
			jobId: job.id,
			save: nextSave,
		});
		nextSave.updatedAtMs = scope.nowMs;

		return {
			events: [
				createCraftFailedEvent({
					job,
					nowMs: scope.nowMs,
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
)(function* ({
	job,
	reason,
	scope,
}: {
	job: GameSaveCraftJob;
	reason: GamePlacementFailureReason;
	scope: CraftCompletionScope;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: scope.save,
	});
	const nextAttemptAtMs = scope.nowMs + blockedCraftCompletionRetryDelayMs;
	nextSave.craftJobs[job.id] = {
		...job,
		delivery: {
			lastBlockedAtMs: scope.nowMs,
			nextAttemptAtMs,
		},
	};
	nextSave.updatedAtMs = scope.nowMs;

	return {
		events:
			job.delivery?.lastBlockedAtMs === undefined
				? [
						createCraftBlockedEvent({
							job,
							nowMs: scope.nowMs,
							reason,
						}),
					]
				: [],
		save: nextSave,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

const completeBlockedCraftJobFx = Effect.fn("completeCraftJobFx.completeBlockedCraftJobFx")(
	function* ({
		job,
		reason,
		scope,
	}: {
		job: GameSaveCraftJob;
		reason: GamePlacementFailureReason;
		scope: CraftCompletionScope;
	}) {
		return yield* match(isGamePlacementFailureRetryable(reason))
			.with(false, () =>
				createFailedCraftCompletionFx({
					job,
					reason,
					scope,
				}),
			)
			.with(true, () =>
				createRetryingCraftCompletionFx({
					job,
					reason,
					scope,
				}),
			)
			.exhaustive();
	},
);

const applyCraftCompletionResultFx = Effect.fn("completeCraftJobFx.applyCraftCompletionResultFx")(
	function* ({ scope, target }: { scope: CraftCompletionScope; target: CraftCompletionTarget }) {
		const nextSave = yield* cloneGameSaveFx({
			save: scope.save,
		});
		const nextTarget = nextSave.board.items[target.liveJob.targetItemInstanceId];
		if (!nextTarget) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Craft job "${target.liveJob.id}" target "${target.liveJob.targetItemInstanceId}" disappeared during completion.`,
				),
			);
		}

		yield* removeCraftJobFromSaveFx({
			jobId: target.liveJob.id,
			save: nextSave,
		});
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: target.liveJob.targetItemInstanceId,
			save: nextSave,
		});
		if (scope.config.items[target.recipe.resultItemId]?.effects?.length) {
			nextTarget.createdAtMs = scope.nowMs;
		} else {
			delete nextTarget.createdAtMs;
		}
		nextTarget.itemId = target.recipe.resultItemId;
		nextSave.updatedAtMs = scope.nowMs;

		return createCraftCompletedResult({
			fromItemId: target.liveTarget.itemId,
			liveJob: target.liveJob,
			nowMs: scope.nowMs,
			recipe: target.recipe,
			save: nextSave,
		});
	},
);

const completeLiveCraftJobFx = Effect.fn("completeCraftJobFx.completeLiveCraftJobFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveCraftJob;
	scope: CraftCompletionScope;
}) {
	const target = yield* readCraftCompletionTargetFx({
		liveJob,
		scope,
	});
	const blockedReason = yield* readCraftCompletionBlockedReasonFx({
		scope,
		target,
	});
	if (blockedReason) {
		return yield* completeBlockedCraftJobFx({
			job: target.liveJob,
			reason: blockedReason,
			scope,
		});
	}
	return yield* applyCraftCompletionResultFx({
		scope,
		target,
	});
});

const completeCraftJobProgramFx = Effect.fn("completeCraftJobFx.completeCraftJobProgramFx")(
	function* (scope: CraftCompletionScope) {
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
