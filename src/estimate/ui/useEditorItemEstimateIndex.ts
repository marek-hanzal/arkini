import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { createEditorItemEstimateIndexFn } from "~/estimate/domain/fn/createEditorItemEstimateIndexFn";
import type { EditorItemEstimateIndexRow } from "~/estimate/domain/EditorItemEstimateIndex";
import type { EditorItemEstimateSortSchema } from "~/estimate/domain/EditorItemEstimateSortSchema";
import { selectEditorItemEstimateIndexFn } from "~/estimate/domain/fn/selectEditorItemEstimateIndexFn";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/estimate/ui/EditorItemEstimateCacheAtom";

export type EditorItemEstimateIndexState =
	| {
			readonly maximumDemand: number;
			readonly rows: ReadonlyArray<EditorItemEstimateIndexRow>;
			readonly status: "loading";
	  }
	| {
			readonly maximumDemand: number;
			readonly rows: ReadonlyArray<EditorItemEstimateIndexRow>;
			readonly status: "ready";
	  }
	| {
			readonly maximumDemand: number;
			readonly message: string;
			readonly rows: ReadonlyArray<EditorItemEstimateIndexRow>;
			readonly status: "error";
	  };

const sameSnapshot = (
	left: EditorItemEstimateCache.Snapshot | undefined,
	right: EditorItemEstimateCache.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

/** Reads the shared result of one full-snapshot estimate batch. */
export const useEditorItemEstimateIndex = (
	project: EditorProject,
	{
		incomplete,
		query,
		sort,
	}: {
		readonly incomplete: boolean;
		readonly query: string;
		readonly sort: EditorItemEstimateSortSchema.Type;
	},
): EditorItemEstimateIndexState => {
	const snapshot = useMemo<EditorItemEstimateCache.Snapshot>(
		() => ({
			config: project.config,
			projectId: project.projectId,
			revision: project.revision,
		}),
		[
			project.config,
			project.projectId,
			project.revision,
		],
	);
	const [state, requestIndex] = useAtom(EditorItemEstimateCacheAtom);

	useEffect(() => {
		requestIndex(snapshot);
	}, [
		requestIndex,
		snapshot,
	]);
	const selection = useMemo(() => {
		const entries = createEditorItemEstimateIndexFn({
			estimates: state.estimates,
			itemIds: Object.keys(project.config.items),
		});
		return {
			maximumDemand: Math.max(0, ...entries.map(({ demand }) => demand)),
			rows: selectEditorItemEstimateIndexFn({
				entries,
				incomplete,
				items: Object.values(project.config.items),
				query,
				sort,
			}),
		};
	}, [
		project.config.items,
		incomplete,
		query,
		sort,
		state.estimates,
	]);
	if (!sameSnapshot(state.snapshot, snapshot))
		return {
			maximumDemand: 0,
			rows: [],
			status: "loading",
		};
	if (state.status === "loading" || state.status === "idle")
		return {
			...selection,
			status: "loading",
		};
	if (state.status === "error")
		return {
			...selection,
			message: state.message ?? "Estimate calculation failed.",
			status: "error",
		};
	return {
		...selection,
		status: "ready",
	};
};
