import type { DateService } from "~/v0/date/context/DateServiceFx";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";

export const pauseCraftTimer = (state: BoardItemState, date: DateService): BoardItemState => {
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
};
