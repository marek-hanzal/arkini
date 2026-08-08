export const EditorOriginFlowVisitHistoryLimit = 32;

/** Adds one click-driven node visit without duplicating the current history head. */
export const pushEditorOriginFlowVisit = (
	history: ReadonlyArray<string>,
	nodeId: string,
): ReadonlyArray<string> => {
	if (history.at(-1) === nodeId) return history;
	return [
		...history,
		nodeId,
	].slice(-EditorOriginFlowVisitHistoryLimit);
};

/** Pops the current click-driven visit and returns the previous node when one exists. */
export const popEditorOriginFlowVisit = (
	history: ReadonlyArray<string>,
): {
	readonly history: ReadonlyArray<string>;
	readonly nodeId: string | undefined;
} => {
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
};
