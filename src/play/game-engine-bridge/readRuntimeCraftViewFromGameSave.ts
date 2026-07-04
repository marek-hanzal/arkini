import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { readCraftRecipeDurationMs } from "~/craft/readCraftRecipeDurationMs";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { ItemId } from "~/config/GameIdSchema";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/time/GameTime";

export namespace readRuntimeCraftViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type CraftProgressPhase = CraftProgressView["phase"];

type RuntimeCraftRecipe = NonNullable<ReturnType<typeof readCraftRecipeDefinition>>;

type RuntimeCraftViewScope = readRuntimeCraftViewFromGameSave.Props & {
	recipe: RuntimeCraftRecipe;
	runningJob: GameSaveCraftJob | undefined;
};

type RuntimeCraftProgressFacts = {
	inputProgress: number;
	timeProgress: number;
};

const readRunningCraftJobForBoardItem = ({
	boardItem,
	save,
}: RuntimeCraftViewScope): GameSaveCraftJob | undefined =>
	Object.values(save.craftJobs).find(
		(job) => job.recipeId === boardItem.itemId && job.targetItemInstanceId === boardItem.id,
	);

const readDeliveredCraftInputs = ({ boardItem, save }: RuntimeCraftViewScope) =>
	save.craftInputs[boardItem.id]?.items ?? {};

const readCraftInputProgress = (scope: RuntimeCraftViewScope): number => {
	const delivered = readDeliveredCraftInputs(scope);
	const totalInputQuantity = scope.recipe.inputs.reduce(
		(total, input) => total + input.quantity,
		0,
	);
	const deliveredInputQuantity = scope.recipe.inputs.reduce(
		(total, input) => total + Math.min(input.quantity, delivered[input.itemId] ?? 0),
		0,
	);
	return scope.runningJob !== undefined || totalInputQuantity === 0
		? 1
		: deliveredInputQuantity / totalInputQuantity;
};

const readCraftPhase = ({ nowMs, runningJob }: RuntimeCraftViewScope): CraftProgressPhase => {
	if (runningJob?.delivery) return "delivery_blocked";
	if (runningJob?.pausedAtMs !== undefined) return "paused";
	if (runningJob?.readyAtMs !== undefined && runningJob.readyAtMs <= nowMs) return "ready";
	if (runningJob?.readyAtMs !== undefined) return "waiting";
	return "collecting_inputs";
};

const readCraftTimeProgress = ({ nowMs, runningJob }: RuntimeCraftViewScope): number => {
	if (runningJob?.startAtMs === undefined || runningJob.readyAtMs === undefined) return 0;
	return readGameTimeProgress({
		nowMs: runningJob.pausedAtMs ?? nowMs,
		readyAtMs: runningJob.readyAtMs,
		startAtMs: runningJob.startAtMs,
	});
};

const readCraftProgressFacts = (scope: RuntimeCraftViewScope): RuntimeCraftProgressFacts => ({
	inputProgress: readCraftInputProgress(scope),
	timeProgress: readCraftTimeProgress(scope),
});

const readAcceptedCraftInputItemIds = ({
	phase,
	scope,
}: {
	phase: CraftProgressPhase;
	scope: RuntimeCraftViewScope;
}): ItemId[] => {
	if (phase !== "collecting_inputs") return [];
	const delivered = readDeliveredCraftInputs(scope);
	return scope.recipe.inputs.flatMap((input) =>
		(delivered[input.itemId] ?? 0) < input.quantity
			? [
					input.itemId as ItemId,
				]
			: [],
	);
};

const readCraftInputViews = (scope: RuntimeCraftViewScope): CraftProgressView["inputs"] =>
	scope.recipe.inputs.map((input) => ({
		available: readRuntimeActivationInputAvailableQuantityFromGameSave({
			itemId: input.itemId,
			save: scope.save,
			targetItemInstanceId: scope.boardItem.id,
		}),
		itemId: input.itemId as ItemId,
		quantity: input.quantity,
	}));

const readCraftTargetLimitViews = (scope: RuntimeCraftViewScope) =>
	readItemTargetLimits({
		config: scope.config,
		ignoredBoardItemInstanceIds: new Set([
			scope.boardItem.id,
		]),
		includePendingCraftJobs: true,
		includePendingProducerJobs: true,
		itemId: scope.recipe.resultItemId,
		nowMs: scope.nowMs,
		save: scope.save,
	});

const readCraftEffectRequirements = (scope: RuntimeCraftViewScope) => {
	const effectState = readCraftLineEffectState({
		config: scope.config,
		nowMs: scope.nowMs,
		recipe: scope.recipe,
		save: scope.save,
	});
	return {
		effectBlocked: effectState.blocked,
		effectBlockReasons: effectState.blockReasons.length ? effectState.blockReasons : undefined,
		effectRequirements: effectState.requirements.length
			? effectState.requirements.map((requirement) => ({
					kind: requirement.kind,
					label: requirement.label,
					ready: requirement.ready,
				}))
			: undefined,
		startRequirementsReady: effectState.startRequirementsReady,
	};
};

const readCraftVisibleProgress = ({
	facts,
	phase,
}: {
	facts: RuntimeCraftProgressFacts;
	phase: CraftProgressPhase;
}) => {
	if (phase === "collecting_inputs") return facts.inputProgress;
	if (phase === "delivery_blocked") return 0;
	return facts.timeProgress;
};

const createRuntimeCraftView = (scope: RuntimeCraftViewScope): CraftProgressView => {
	const phase = readCraftPhase(scope);
	const acceptedInputItemIds = readAcceptedCraftInputItemIds({
		phase,
		scope,
	});
	const durationMs = readCraftRecipeDurationMs({
		recipe: scope.recipe,
		save: scope.save,
	});
	const progressFacts = readCraftProgressFacts(scope);
	const targetLimits = readCraftTargetLimitViews(scope);
	const clockNowMs = scope.runningJob?.pausedAtMs ?? scope.nowMs;

	return {
		...readCraftEffectRequirements(scope),
		acceptedInputItemIds,
		canAcceptInputs: acceptedInputItemIds.length > 0,
		complete: phase === "ready",
		delivered: readDeliveredCraftInputs(scope),
		deliveryBlocked: scope.runningJob?.delivery !== undefined,
		durationMs,
		id: scope.boardItem.itemId,
		inputProgress: progressFacts.inputProgress,
		inputs: readCraftInputViews(scope),
		pausedAtMs: scope.runningJob?.pausedAtMs,
		phase,
		progress: readCraftVisibleProgress({
			facts: progressFacts,
			phase,
		}),
		readyAtMs: scope.runningJob?.readyAtMs,
		remainingMs:
			scope.runningJob?.readyAtMs !== undefined
				? readGameTimeRemainingMs({
						nowMs: clockNowMs,
						readyAtMs: scope.runningJob.readyAtMs,
					})
				: undefined,
		resultItemId: scope.recipe.resultItemId as ItemId,
		startAtMs: scope.runningJob?.startAtMs,
		targetLimitBlocked: readTargetLimitBlocked(targetLimits),
		targetLimits: targetLimits.length ? targetLimits : undefined,
		timeProgress: progressFacts.timeProgress,
	};
};

export const readRuntimeCraftViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeCraftViewFromGameSave.Props): CraftProgressView | undefined => {
	const recipe = readCraftRecipeDefinition({
		config,
		recipeId: boardItem.itemId,
	});
	if (!recipe) return undefined;

	const scopeWithoutJob = {
		boardItem,
		config,
		nowMs,
		recipe,
		runningJob: undefined,
		save,
	} satisfies RuntimeCraftViewScope;

	return createRuntimeCraftView({
		...scopeWithoutJob,
		runningJob: readRunningCraftJobForBoardItem(scopeWithoutJob),
	});
};
