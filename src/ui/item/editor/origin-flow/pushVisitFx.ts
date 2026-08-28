import { Effect } from "effect";

import { VisitHistoryLimit } from "~/ui/item/editor/origin-flow/VisitHistory";

/** Adds one click-driven node visit without duplicating the current history head. */
export const pushVisitFx = Effect.fn("pushVisitFx")(
	(history: ReadonlyArray<string>, nodeId: string) =>
		Effect.sync((): ReadonlyArray<string> => {
			if (history.at(-1) === nodeId) return history;
			return [
				...history,
				nodeId,
			].slice(-VisitHistoryLimit);
		}),
);
