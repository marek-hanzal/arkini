import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorItemEstimate } from "~/estimate/domain/EditorItemEstimate";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/estimate/ui/makeEditorItemEstimateCacheAtomFx";

export type EditorItemEstimateState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly estimate: EditorItemEstimate;
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

/** Reads a cached estimate or requests one from the renderer-owned estimate authority. */
export const useEditorItemEstimate = (
	project: EditorProject,
	itemId: string,
): EditorItemEstimateState => {
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
	const [state, requestEstimate] = useAtom(EditorItemEstimateCacheAtom);

	useEffect(() => {
		requestEstimate(snapshot);
	}, [
		requestEstimate,
		snapshot,
	]);

	if (!sameSnapshot(state.snapshot, snapshot))
		return {
			status: "loading",
		};
	if (state.status === "error")
		return {
			message: state.message ?? "Estimate calculation failed.",
			status: "error",
		};
	const estimate = state.estimates.get(itemId);
	if (estimate !== undefined)
		return {
			estimate,
			status: "ready",
		};
	if (state.status === "ready")
		return {
			message: `The estimate batch did not return ${itemId}.`,
			status: "error",
		};
	return {
		status: "loading",
	};
};
