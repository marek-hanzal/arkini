import { Effect } from "effect";

import type { EditorItemOriginSourceIndex } from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";
import {
	readEditorItemOriginIncomeSubgraph,
	type EditorItemOriginIncomeSubgraph,
} from "~/editor/EditorItemOriginSource";

export type { EditorItemOriginIncomeSubgraph } from "~/editor/EditorItemOriginSource";

/** Traces the shared one witnessed Income proof selected by reachability. */
export const readEditorItemOriginIncomeSubgraphFx = Effect.fn(
	"readEditorItemOriginIncomeSubgraphFx",
)(
	({
		acquisitionSourceByItem,
		sourcesById,
		sourcesByOutput,
		starters,
		targetItemId,
	}: Pick<EditorItemOriginSourceIndex, "sourcesById" | "sourcesByOutput" | "starters"> & {
		readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
		readonly targetItemId: string;
	}) =>
		Effect.sync((): EditorItemOriginIncomeSubgraph => {
			const sources = [
				...sourcesById.values(),
			];
			if (sources.length === 0)
				for (const matches of sourcesByOutput.values()) sources.push(...matches);
			return readEditorItemOriginIncomeSubgraph({
				acquisitionSourceByItem,
				sources,
				starters: new Set(starters.keys()),
				targetItemId,
			});
		}),
);
