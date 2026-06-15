import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";
import { resolveCraftProgress } from "~/v0/craft/logic/resolveCraftProgress";
import type { DateService } from "~/v0/date/context/DateServiceFx";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";

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

	const progress = resolveCraftProgress({
		recipe,
		storedInputs,
	});
	const inputsComplete = progress.inputsComplete;
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
		delivered: progress.delivered,
		inputProgress: progress.inputProgress,
		timeProgress,
		progress: phase === "collecting_inputs" ? progress.inputProgress : timeProgress,
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
