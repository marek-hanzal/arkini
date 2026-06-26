import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationRequirementViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";

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
	const recipeId = config.items[boardItem.itemId]?.craftRecipeId;
	if (!recipeId) return undefined;
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
	const startedAtMs = runningJob?.startedAtMs;
	const readyAtMs = runningJob?.completesAtMs;
	const timeProgress =
		startedAtMs !== undefined && readyAtMs !== undefined
			? Math.max(0, Math.min(1, (nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs)))
			: 0;
	const phase =
		readyAtMs !== undefined && readyAtMs <= nowMs
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
		durationMs: recipe.durationMs,
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
		remainingMs: readyAtMs !== undefined ? Math.max(0, readyAtMs - nowMs) : undefined,
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: recipe.requirements,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		resultItemId: recipe.resultItemId as ItemId,
		startedAtMs,
		timeProgress,
	};
};
