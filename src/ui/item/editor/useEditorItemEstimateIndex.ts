import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/ui/item/editor/EditorItemEstimateCacheAtom";

export type EditorItemEstimateIndexState =
	| {
			readonly completed: number;
			readonly status: "loading";
			readonly total: number;
	  }
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly status: "ready";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

const sameSnapshot = (
	left: EditorItemEstimateCache.Snapshot | undefined,
	right: EditorItemEstimateCache.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

/** Reads the persistent all-item estimate projection for the current project snapshot. */
export const useEditorItemEstimateIndex = (
	project: EditorProject,
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
	const request = useMemo<EditorItemEstimateCache.Request>(
		() => ({
			snapshot,
			type: "index",
		}),
		[
			snapshot,
		],
	);
	const [state, requestIndex] = useAtom(EditorItemEstimateCacheAtom);

	useEffect(() => {
		requestIndex(request);
	}, [
		request,
		requestIndex,
	]);

	if (!sameSnapshot(state.snapshot, snapshot))
		return {
			completed: 0,
			status: "loading",
			total: Object.keys(project.config.items).length,
		};
	if (state.indexEntries !== undefined)
		return {
			entries: state.indexEntries,
			status: "ready",
		};
	if (state.indexError !== undefined)
		return {
			message: state.indexError,
			status: "error",
		};
	return {
		completed: state.progress.completed,
		status: "loading",
		total: state.progress.total,
	};
};
