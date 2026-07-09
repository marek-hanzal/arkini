import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";
import { readCraftEffectiveLootPlan } from "~/craft/readCraftEffectiveLootPlan";
import { readCraftRecipeDurationMs } from "~/craft/readCraftRecipeDurationMs";
import {
	readCraftOutputItemIds,
	readCraftPrimaryOutputItemId,
} from "~/craft/readCraftRecipeOutput";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { ItemId } from "~/config/GameIdSchema";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeLineOutputViews } from "~/play/game-engine-bridge/readRuntimeLineOutputViews";
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

type CraftViewEffectRequirementState = Pick<
	CraftProgressView,
	"effectBlocked" | "effectBlockReasons" | "effectRequirements" | "startRequirementsReady"
>;

const readRunningCraftJobForBoardItem = ({
	boardItem,
	save,
}: readRuntimeCraftViewFromGameSave.Props): GameSaveCraftJob | undefined =>
	Object.values(save.craftJobs).find(
		(job) => job.recipeId === boardItem.itemId && job.targetItemInstanceId === boardItem.id,
	);

const readDeliveredCraftInputs = ({
	boardItem,
	save,
}: readRuntimeCraftViewFromGameSave.Props) => save.craftInputs[boardItem.id]?.items ?? {};

const readCraftInputProgress = ({
	delivered,
	recipe,
	runningJob,
}: {
	delivered: Record<string, number>;
	recipe: RuntimeCraftRecipe;
	runningJob: GameSaveCraftJob | undefined;
}): number => {
	const totalInputQuantity = recipe.inputs.reduce((total, input) => total + input.quantity, 0);
	const deliveredInputQuantity = recipe.inputs.reduce(
		(total, input) => total + Math.min(input.quantity, delivered[input.itemId] ?? 0),
		0,
	);
	return runningJob !== undefined || totalInputQuantity === 0
		? 1
		: deliveredInputQuantity / totalInputQuantity;
};

const readCraftPhase = ({ nowMs, runningJob }: { nowMs: number; runningJob: GameSaveCraftJob | undefined }) => {
	if (runningJob?.delivery) return "delivery_blocked" satisfies CraftProgressPhase;
	if (runningJob?.pausedAtMs !== undefined) return "paused" satisfies CraftProgressPhase;
	if (runningJob?.readyAtMs !== undefined && runningJob.readyAtMs <= nowMs) {
		return "ready" satisfies CraftProgressPhase;
	}
	if (runningJob?.readyAtMs !== undefined) return "waiting" satisfies CraftProgressPhase;
	return "collecting_inputs" satisfies CraftProgressPhase;
};

const readCraftTimeProgress = ({ nowMs, runningJob }: { nowMs: number; runningJob: GameSaveCraftJob | undefined }) => {
	if (runningJob?.startAtMs === undefined || runningJob.readyAtMs === undefined) return 0;
	return readGameTimeProgress({
		nowMs: runningJob.pausedAtMs ?? nowMs,
		readyAtMs: runningJob.readyAtMs,
		startAtMs: runningJob.startAtMs,
	});
};

const readAcceptedCraftInputItemIds = ({
	delivered,
	phase,
	recipe,
}: {
	delivered: Record<string, number>;
	phase: CraftProgressPhase;
	recipe: RuntimeCraftRecipe;
}): ItemId[] => {
	if (phase !== "collecting_inputs") return [];
	return recipe.inputs.flatMap((input) =>
		(delivered[input.itemId] ?? 0) < input.quantity ? [input.itemId as ItemId] : [],
	);
};

const readCraftInputViews = ({
	boardItem,
	recipe,
	save,
}: Pick<readRuntimeCraftViewFromGameSave.Props, "boardItem" | "save"> & {
	recipe: RuntimeCraftRecipe;
}): CraftProgressView["inputs"] =>
	recipe.inputs.map((input) => ({
		available: readRuntimeActivationInputAvailableQuantityFromGameSave({
			itemId: input.itemId,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		itemId: input.itemId as ItemId,
		quantity: input.quantity,
	}));

const readCraftTargetLimitViews = ({
	boardItem,
	config,
	nowMs,
	recipe,
	save,
}: readRuntimeCraftViewFromGameSave.Props & { recipe: RuntimeCraftRecipe }) =>
	readCraftOutputItemIds(recipe).flatMap((itemId) =>
		readItemTargetLimits({
			config,
			ignoredBoardItemInstanceIds: new Set([boardItem.id]),
			includePendingCraftJobs: true,
			includePendingProducerJobs: true,
			itemId,
			nowMs,
			save,
		}),
	);

const readCraftEffectRequirementState = ({
	config,
	grantIds,
	nowMs,
	recipe,
	save,
}: Pick<readRuntimeCraftViewFromGameSave.Props, "config" | "nowMs" | "save"> & {
	grantIds: ReadonlySet<string>;
	recipe: RuntimeCraftRecipe;
}): CraftViewEffectRequirementState => {
	const effectState = readCraftLineEffectState({
		config,
		grantIds,
		nowMs,
		recipe,
		save,
	});
	return {
		effectBlocked: effectState.blocked,
		effectBlockReasons: effectState.blockReasons.length ? effectState.blockReasons : undefined,
		effectRequirements: effectState.requirements.length
			? effectState.requirements.map((requirement) => ({
					itemId: requirement.itemId,
					kind: requirement.kind,
					label: requirement.label,
					ready: requirement.ready,
			  }))
			: undefined,
		startRequirementsReady: effectState.startRequirementsReady,
	};
};

const readCraftOutputViews = ({
	boardItem,
	config,
	grantIds,
	recipe,
	save,
}: Pick<readRuntimeCraftViewFromGameSave.Props, "boardItem" | "config" | "save"> & {
	grantIds: ReadonlySet<string>;
	recipe: RuntimeCraftRecipe;
}): CraftProgressView["outputs"] => {
	const outputs = readRuntimeLineOutputViews({
		lootPlan: readCraftEffectiveLootPlan({
			config,
			grantIds,
			itemInstanceId: boardItem.id,
			lineId: boardItem.itemId,
			recipe,
			save,
		}),
		save,
	});
	return outputs.length > 0 ? outputs : undefined;
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
	const grantIds = readGameWorldGrantIds({
		config,
		nowMs,
		save,
	});
	const runningJob = readRunningCraftJobForBoardItem({
		boardItem,
		config,
		nowMs,
		save,
	});
	const delivered = readDeliveredCraftInputs({
		boardItem,
		config,
		nowMs,
		save,
	});
	const phase = readCraftPhase({ nowMs, runningJob });
	const inputProgress = readCraftInputProgress({
		delivered,
		recipe,
		runningJob,
	});
	const timeProgress = readCraftTimeProgress({ nowMs, runningJob });
	const acceptedInputItemIds = readAcceptedCraftInputItemIds({
		delivered,
		phase,
		recipe,
	});
	const targetLimits = readCraftTargetLimitViews({
		boardItem,
		config,
		nowMs,
		recipe,
		save,
	});
	const clockNowMs = runningJob?.pausedAtMs ?? nowMs;
	const durationMs = readCraftRecipeDurationMs({
		recipe,
		save,
	});

	return {
		...readCraftEffectRequirementState({
			config,
			grantIds,
			nowMs,
			recipe,
			save,
		}),
		acceptedInputItemIds,
		canAcceptInputs: acceptedInputItemIds.length > 0,
		complete: phase === "ready",
		delivered,
		deliveryBlocked: runningJob?.delivery !== undefined,
		durationMs,
		id: boardItem.itemId,
		inputProgress,
		inputs: readCraftInputViews({
			boardItem,
			recipe,
			save,
		}),
		outputs: readCraftOutputViews({
			boardItem,
			config,
			grantIds,
			recipe,
			save,
		}),
		pausedAtMs: runningJob?.pausedAtMs,
		phase,
		progress: phase === "collecting_inputs" ? inputProgress : phase === "delivery_blocked" ? 0 : timeProgress,
		readyAtMs: runningJob?.readyAtMs,
		remainingMs:
			runningJob?.readyAtMs !== undefined
				? readGameTimeRemainingMs({
						nowMs: clockNowMs,
						readyAtMs: runningJob.readyAtMs,
				  })
				: undefined,
		resultItemId: readCraftPrimaryOutputItemId(recipe) as ItemId,
		startAtMs: runningJob?.startAtMs,
		targetLimitBlocked: readTargetLimitBlocked(targetLimits),
		targetLimits: targetLimits.length ? targetLimits : undefined,
		timeProgress,
	};
};
