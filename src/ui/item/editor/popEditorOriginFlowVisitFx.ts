import { Effect } from "effect";

export interface EditorOriginFlowPoppedVisit {
	readonly history: ReadonlyArray<string>;
	readonly nodeId: string | undefined;
}

/** Pops the current click-driven visit and returns the previous node when one exists. */
export const popEditorOriginFlowVisitFx = Effect.fn("popEditorOriginFlowVisitFx")(
	(history: ReadonlyArray<string>) =>
		Effect.sync((): EditorOriginFlowPoppedVisit => {
			if (history.length < 2)
				return {
					history,
					nodeId: undefined,
				};
			const nextHistory = history.slice(0, -1);
			return {
				history: nextHistory,
				nodeId: nextHistory.at(-1),
			};
		}),
);
