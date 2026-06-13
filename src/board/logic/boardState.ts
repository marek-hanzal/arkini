import { match } from "ts-pattern";
import type { DateService } from "~/date/context/DateServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ProducerMode } from "~/manifest/data/producer";
import type { BoardItemState, CraftProgressView, ProducerView } from "~/play/logic/playTypes";
import { parseJson } from "~/shared/json";

export function createInitialBoardState(
	itemId: string,
	gameConfig: GameConfigService,
): BoardItemState {
	const producer = gameConfig.getProducer(itemId);
	if (!producer) return {};

	const mode = producer.mode ?? {
		type: "infinite" as const,
	};

	return match(mode as ProducerMode)
		.with(
			{
				type: "finite",
			},
			(finite) => ({
				producer: {
					remainingCharges: finite.charges,
				},
			}),
		)
		.with(
			{
				type: "infinite",
			},
			() => ({
				producer: {},
			}),
		)
		.exhaustive();
}

export namespace readProducerView {
	export interface Props {
		itemId: string;
		state: BoardItemState;
		date: DateService;
		gameConfig: GameConfigService;
	}
}

export function readProducerView({
	itemId,
	state,
	date,
	gameConfig,
}: readProducerView.Props): ProducerView | undefined {
	const producer = gameConfig.getProducer(itemId);
	if (!producer) return undefined;

	const initial = createInitialBoardState(itemId, gameConfig).producer ?? {};
	const producerState = {
		...initial,
		...(state.producer ?? {}),
	};

	const cooldownUntil = producerState.cooldownUntil;

	return {
		trigger: producer.trigger,
		mode: producer.mode ?? {
			type: "infinite",
		},
		cooldownMs: producer.cooldownMs,
		doubleClickBehavior: producer.doubleClickBehavior,
		cooldownUntil,
		cooldownUntilMs: cooldownUntil ? date.parseTimestampMs(cooldownUntil) : undefined,
		remainingCharges: producerState.remainingCharges,
	};
}

export namespace readCraftView {
	export interface Props {
		itemId: string;
		state: BoardItemState;
		gameConfig: GameConfigService;
	}
}

export function readCraftView({
	itemId,
	state,
	gameConfig,
}: readCraftView.Props): CraftProgressView | undefined {
	const recipe = gameConfig.getCraftRecipeForTarget(itemId);
	if (!recipe) return undefined;

	const delivered = state.craft?.delivered ?? {};
	const required = recipe.inputs.reduce((sum, input) => sum + input.quantity, 0);
	const current = recipe.inputs.reduce((sum, input) => {
		return sum + Math.min(delivered[input.itemId] ?? 0, input.quantity);
	}, 0);
	const progress = required <= 0 ? 0 : Math.min(1, current / required);

	return {
		id: recipe.id,
		resultItemId: recipe.resultItemId,
		inputs: [
			...recipe.inputs,
		],
		delivered,
		progress,
		complete: progress >= 1,
		acceptedInputItemIds: recipe.inputs.map((input) => input.itemId),
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
