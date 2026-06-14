import type { DateService } from "~/date/context/DateServiceFx";
import type { BoardItemState } from "~/play/logic/playTypes";

export function pauseCraftTimer(state: BoardItemState, date: DateService): BoardItemState {
	const craft = state.craft;
	if (!craft?.readyAt) return state;
	const readyAtMs = date.parseTimestampMs(craft.readyAt);
	if (readyAtMs === undefined) return state;

	return {
		...state,
		craft: {
			...craft,
			startedAt: undefined,
			readyAt: undefined,
			remainingMs: Math.max(0, readyAtMs - date.nowMs()),
		},
	};
}

export function resumeCraftTimer(state: BoardItemState, date: DateService): BoardItemState {
	const craft = state.craft;
	if (craft?.remainingMs === undefined) return state;
	const now = date.now();

	return {
		...state,
		craft: {
			...craft,
			remainingMs: undefined,
			startedAt: date.toTimestamp(now),
			readyAt: date.toTimestamp(
				now.plus({
					milliseconds: craft.remainingMs,
				}),
			),
		},
	};
}
