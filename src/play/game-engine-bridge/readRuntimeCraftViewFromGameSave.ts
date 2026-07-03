import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { ItemId } from "~/config/GameIdSchema";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/time/GameTime";
import { readCraftRecipeDurationMs } from "~/craft/readCraftRecipeDurationMs";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";

export namespace readRuntimeCraftViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeCraftViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeCraftViewFromGameSave.Props): CraftProgressView | undefined => {
	const recipeId = boardItem.itemId;
	const recipe = readCraftRecipeDefinition({
		config,
		recipeId,
	});
	if (!recipe) return undefined;

	const runningJob = Object.values(save.craftJobs).find(
		(job) => job.recipeId === recipeId && job.targetItemInstanceId === boardItem.id,
	);
	const delivered = save.craftInputs[boardItem.id]?.items ?? {};
	const totalInputQuantity = recipe.inputs.reduce((total, input) => total + input.quantity, 0);
	const deliveredInputQuantity = recipe.inputs.reduce(
		(total, input) => total + Math.min(input.quantity, delivered[input.itemId] ?? 0),
		0,
	);
	const inputProgress =
		runningJob !== undefined || totalInputQuantity === 0
			? 1
			: deliveredInputQuantity / totalInputQuantity;
	const durationMs = readCraftRecipeDurationMs({
		recipe,
		save,
	});
	const startAtMs = runningJob?.startAtMs;
	const readyAtMs = runningJob?.readyAtMs;
	const pausedAtMs = runningJob?.pausedAtMs;
	const deliveryBlocked = runningJob?.delivery !== undefined;
	const clockNowMs = pausedAtMs ?? nowMs;
	const timeProgress =
		startAtMs !== undefined && readyAtMs !== undefined
			? readGameTimeProgress({
					nowMs: clockNowMs,
					readyAtMs,
					startAtMs,
				})
			: 0;
	const phase = deliveryBlocked
		? "delivery_blocked"
		: pausedAtMs !== undefined
			? "paused"
			: readyAtMs !== undefined && readyAtMs <= nowMs
				? "ready"
				: readyAtMs !== undefined
					? "waiting"
					: "collecting_inputs";
	const acceptedInputItemIds =
		phase === "collecting_inputs"
			? recipe.inputs.flatMap((input) =>
					(delivered[input.itemId] ?? 0) < input.quantity
						? [
								input.itemId as ItemId,
							]
						: [],
				)
			: [];
	const targetLimits = readItemTargetLimits({
		config,
		ignoredBoardItemInstanceIds: new Set([
			boardItem.id,
		]),
		includePendingCraftJobs: true,
		includePendingProducerJobs: true,
		nowMs,
		itemId: recipe.resultItemId,
		save,
	});
	const effectState = readCraftLineEffectState({
		config,
		nowMs,
		recipe,
		save,
	});

	return {
		acceptedInputItemIds,
		canAcceptInputs: acceptedInputItemIds.length > 0,
		complete: phase === "ready",
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
		deliveryBlocked,
		targetLimitBlocked: readTargetLimitBlocked(targetLimits),
		targetLimits: targetLimits.length ? targetLimits : undefined,
		delivered,
		durationMs,
		id: recipeId,
		inputProgress,
		inputs: recipe.inputs.map((input) => ({
			available: readRuntimeActivationInputAvailableQuantityFromGameSave({
				itemId: input.itemId,
				save,
				targetItemInstanceId: boardItem.id,
			}),
			itemId: input.itemId as ItemId,
			quantity: input.quantity,
		})),
		phase,
		progress:
			phase === "collecting_inputs"
				? inputProgress
				: phase === "delivery_blocked"
					? 0
					: timeProgress,
		readyAtMs,
		pausedAtMs,
		remainingMs:
			readyAtMs !== undefined
				? readGameTimeRemainingMs({
						nowMs: clockNowMs,
						readyAtMs,
					})
				: undefined,
		resultItemId: recipe.resultItemId as ItemId,
		startAtMs,
		timeProgress,
	};
};
