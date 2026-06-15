import type { DateService } from "~/date/context/DateServiceFx";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";

export const resumeCraftTimer = (state: BoardItemState, date: DateService): BoardItemState => {
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
};
