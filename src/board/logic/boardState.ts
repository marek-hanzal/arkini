import type { DateService } from "~/date/context/DateServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import { applyProducerUpgradeEffects } from "~/upgrade/logic/applyProducerUpgradeEffects";
import type { OwnedUpgradeRow } from "~/upgrade/logic/readOwnedUpgradeEffects";
import type { ActivationView, BoardItemState, CraftProgressView } from "~/play/logic/playTypes";
import { parseJson } from "~/shared/json";

export function createInitialBoardState(
	itemId: string,
	gameConfig: GameConfigService,
): BoardItemState {
	const stash = gameConfig.getStash(itemId);
	if (!stash) return {};

	return {
		activation: {
			remainingCharges: stash.charges,
		},
	};
}

export namespace readActivationView {
	export interface Props {
		itemId: string;
		state: BoardItemState;
		date: DateService;
		gameConfig: GameConfigService;
		upgradeRows?: readonly OwnedUpgradeRow[];
	}
}

export function readActivationView({
	itemId,
	state,
	date,
	gameConfig,
	upgradeRows = [],
}: readActivationView.Props): ActivationView | undefined {
	const baseActivation = gameConfig.getActivation(itemId);
	if (!baseActivation) return undefined;

	const activation =
		baseActivation.type === "producer"
			? applyProducerUpgradeEffects({
					gameConfig,
					producerItemId: itemId,
					producer: baseActivation,
					upgradeRows,
				})
			: baseActivation;

	const initial = createInitialBoardState(itemId, gameConfig).activation ?? {};
	const activationState = {
		...initial,
		...(state.activation ?? {}),
	};

	const cooldownUntil = activationState.cooldownUntil;
	const inventory = activationState.inventory ?? {};

	return {
		kind: activation.type,
		trigger: activation.trigger,
		cooldownMs: activation.type === "producer" ? activation.cooldownMs : undefined,
		cooldownUntil,
		cooldownUntilMs: cooldownUntil ? date.parseTimestampMs(cooldownUntil) : undefined,
		remainingCharges: activationState.remainingCharges,
		inputs: (activation.inputs ?? []).map((input) => ({
			itemId: input.itemId,
			quantity: input.quantity,
			capacity: input.capacity,
			stored: inventory[input.itemId] ?? 0,
		})),
	};
}

export namespace readCraftView {
	export interface Props {
		itemId: string;
		state: BoardItemState;
		date: DateService;
		gameConfig: GameConfigService;
	}
}

export function readCraftView({
	itemId,
	state,
	date,
	gameConfig,
}: readCraftView.Props): CraftProgressView | undefined {
	const recipe = gameConfig.getCraftRecipeForTarget(itemId);
	if (!recipe) return undefined;

	const delivered = state.craft?.delivered ?? {};
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
}

export function readBoardState(row: Pick<readBoardState.Row, "stateJson">) {
	return parseJson<BoardItemState>(row.stateJson || "{}");
}

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}
