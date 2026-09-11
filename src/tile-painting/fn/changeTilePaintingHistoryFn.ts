import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace changeTilePaintingHistoryFn {
	export interface History {
		readonly past: ReadonlyArray<TilePaintingDocumentSchema.Type>;
		readonly present: TilePaintingDocumentSchema.Type;
		readonly future: ReadonlyArray<TilePaintingDocumentSchema.Type>;
	}
	export type Action =
		| {
				readonly type: "edit";
				readonly document: TilePaintingDocumentSchema.Type;
		  }
		| {
				readonly type: "undo" | "redo";
		  };
}

/** History shares immutable images and stroke arrays; a completed gesture is one edit. */
export const changeTilePaintingHistoryFn = (
	history: changeTilePaintingHistoryFn.History,
	action: changeTilePaintingHistoryFn.Action,
): changeTilePaintingHistoryFn.History => {
	if (action.type === "edit") {
		if (action.document === history.present) return history;
		return {
			past: [
				...history.past,
				history.present,
			].slice(-100),
			present: action.document,
			future: [],
		};
	}
	if (action.type === "undo") {
		const previous = history.past.at(-1);
		return previous === undefined
			? history
			: {
					past: history.past.slice(0, -1),
					present: previous,
					future: [
						history.present,
						...history.future,
					],
				};
	}
	const next = history.future[0];
	return next === undefined
		? history
		: {
				past: [
					...history.past,
					history.present,
				],
				present: next,
				future: history.future.slice(1),
			};
};
