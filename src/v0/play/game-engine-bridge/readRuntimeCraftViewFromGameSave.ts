import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationRequirementViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";
import { readGameTimeProgress, readGameTimeRemainingMs } from "~/v0/game/time/GameTime";
import { readCraftRecipeDurationMs } from "~/v0/game/craft/readCraftRecipeDurationMs";

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
	const recipe = config.craftRecipes[recipeId];
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
		totalInputQuantity === 0 ? 1 : deliveredInputQuantity / totalInputQuantity;
	const durationMs = readCraftRecipeDurationMs({
		recipe,
		save,
		targetItemInstanceId: boardItem.id,
	});
	const startAtMs = runningJob?.startAtMs;
	const readyAtMs = runningJob?.readyAtMs;
	const pausedAtMs = runningJob?.pausedAtMs;
	const clockNowMs = pausedAtMs ?? nowMs;
	const timeProgress =
		startAtMs !== undefined && readyAtMs !== undefined
			? readGameTimeProgress({
					nowMs: clockNowMs,
					readyAtMs,
					startAtMs,
				})
			: 0;
	const phase =
		pausedAtMs !== undefined
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

	return {
		acceptedInputItemIds,
		canAcceptInputs: acceptedInputItemIds.length > 0,
		complete: phase === "ready",
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
		progress: phase === "collecting_inputs" ? inputProgress : timeProgress,
		readyAtMs,
		pausedAtMs,
		remainingMs:
			readyAtMs !== undefined
				? readGameTimeRemainingMs({
						nowMs: clockNowMs,
						readyAtMs,
					})
				: undefined,
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: recipe.requirements,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		resultItemId: recipe.resultItemId as ItemId,
		startAtMs,
		timeProgress,
	};
};
