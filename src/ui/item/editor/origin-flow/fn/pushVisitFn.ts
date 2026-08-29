const VisitHistoryLimit = 32;

/** Adds one click-driven node visit without duplicating the current history head. */
export const pushVisitFn = (
	history: ReadonlyArray<string>,
	nodeId: string,
): ReadonlyArray<string> => {
	if (history.at(-1) === nodeId) return history;
	return [
		...history,
		nodeId,
	].slice(-VisitHistoryLimit);
};
