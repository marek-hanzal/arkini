import { match } from "ts-pattern";
import type { DateService } from "~/date/context/DateServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ProducerMode } from "~/manifest/data/producer";
import type { BoardItemState, ProducerView } from "~/play/logic/playTypes";
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

export function readBoardState(row: Pick<readBoardState.Row, "stateJson">) {
	return parseJson<BoardItemState>(row.stateJson || "{}");
}

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}
