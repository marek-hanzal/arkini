import { DateTime } from "luxon";
import { match } from "ts-pattern";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerMode } from "~/manifest/data/producer";
import { parseJson } from "~/shared/json";
import type { BoardItemState, ProducerView } from "~/play/logic/playTypes";

export function createInitialBoardState(itemId: string): BoardItemState {
	const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
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

export function readProducerView(itemId: string, state: BoardItemState): ProducerView | undefined {
	const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
	if (!producer) return undefined;

	const initial = createInitialBoardState(itemId).producer ?? {};
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
		cooldownUntilMs: cooldownUntil ? parseTimestampMs(cooldownUntil) : undefined,
		remainingCharges: producerState.remainingCharges,
	};
}

function parseTimestampMs(value: string) {
	const parsed = DateTime.fromISO(value);
	return parsed.isValid ? parsed.toMillis() : undefined;
}

export function readBoardState(row: Pick<readBoardState.Row, "stateJson">) {
	return parseJson<BoardItemState>(row.stateJson || "{}");
}

export namespace readBoardState {
	export interface Row {
		stateJson: string;
	}
}
