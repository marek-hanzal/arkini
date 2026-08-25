import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createEditorItemEstimateIndexFx } from "~/editor/createEditorItemEstimateIndexFx";
import type { EditorItemEstimateIndexRow } from "~/editor/EditorItemEstimateIndex";
import type { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";
import { selectEditorItemEstimateIndexFx } from "~/editor/selectEditorItemEstimateIndexFx";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/ui/item/editor/makeEditorItemEstimateCacheAtomFx";

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
		query,
		sort,
	}: {
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
		const entries = RendererRuntime.runSync(
			createEditorItemEstimateIndexFx({
				estimates: state.estimates,
				itemIds: Object.keys(project.config.items),
			}),
		);
		return {
			maximumDemand: Math.max(0, ...entries.map(({ demand }) => demand)),
			rows: RendererRuntime.runSync(
				selectEditorItemEstimateIndexFx({
					entries,
					items: Object.values(project.config.items),
					query,
					sort,
				}),
			),
		};
	}, [
		project.config.items,
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
