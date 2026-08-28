import { Effect } from "effect";

import { EditorOriginFlowVisitHistoryLimit } from "~/ui/item/editor/EditorOriginFlowVisitHistory";

/** Adds one click-driven node visit without duplicating the current history head. */
export const pushEditorOriginFlowVisitFx = Effect.fn("pushEditorOriginFlowVisitFx")(
	(history: ReadonlyArray<string>, nodeId: string) =>
		Effect.sync((): ReadonlyArray<string> => {
			if (history.at(-1) === nodeId) return history;
			return [
				...history,
				nodeId,
			].slice(-EditorOriginFlowVisitHistoryLimit);
		}),
);
