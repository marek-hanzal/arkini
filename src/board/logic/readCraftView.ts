import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import type { DateService } from "~/date/context/DateServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";

export namespace readCraftView {
	export interface Props {
		itemId: ItemId;
		state: BoardItemState;
		date: DateService;
		gameConfig: GameConfigService;
		storedInputs?: ReadonlyMap<ItemId, number>;
	}
}

export const readCraftView = ({
	itemId,
	state,
	date,
	gameConfig,
	storedInputs = new Map(),
}: readCraftView.Props): CraftProgressView | undefined => {
	const recipe = gameConfig.getCraftRecipeForTarget(itemId);
	if (!recipe) return undefined;

	const delivered = Object.fromEntries(
		recipe.inputs.map((input) => [
			input.itemId,
			storedInputs.get(input.itemId) ?? 0,
		]),
	);
	const required = recipe.inputs.reduce((sum, input) => sum + input.quantity, 0);
	const current = recipe.inputs.reduce((sum, input) => {
		return sum + Math.min(delivered[input.itemId] ?? 0, input.quantity);
	}, 0);
	const inputProgress = required <= 0 ? 0 : Math.min(1, current / required);
	const inputsComplete = inputProgress >= 1;
	const startedAtMs = state.craft?.startedAt
		? date.parseTimestampMs(state.craft.startedAt)
		: undefined;
	const readyAtMs = state.craft?.readyAt ? date.parseTimestampMs(state.craft.readyAt) : undefined;
	const nowMs = date.nowMs();
	const remainingMs =
		readyAtMs !== undefined ? Math.max(0, readyAtMs - nowMs) : state.craft?.remainingMs;
	const timeProgress =
		inputsComplete && startedAtMs !== undefined && readyAtMs !== undefined
			? Math.max(0, Math.min(1, (nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs)))
			: inputsComplete && recipe.durationMs === 0
				? 1
				: 0;
	const phase = !inputsComplete
		? "collecting_inputs"
		: readyAtMs !== undefined && readyAtMs <= nowMs
			? "ready"
			: inputsComplete && (readyAtMs !== undefined || state.craft?.remainingMs !== undefined)
				? "waiting"
				: recipe.durationMs === 0
					? "ready"
					: "waiting";

	return {
		id: recipe.id,
		resultItemId: recipe.resultItemId,
		durationMs: recipe.durationMs,
		inputs: [
			...recipe.inputs,
		],
		delivered,
		inputProgress,
		timeProgress,
		progress: phase === "collecting_inputs" ? inputProgress : timeProgress,
		phase,
		complete: phase === "ready",
		canAcceptInputs: phase === "collecting_inputs",
		startedAtMs,
		readyAtMs,
		remainingMs,
		acceptedInputItemIds:
			phase === "collecting_inputs" ? recipe.inputs.map((input) => input.itemId) : [],
	};
};
