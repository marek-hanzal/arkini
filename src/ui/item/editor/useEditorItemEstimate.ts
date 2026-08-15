import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/ui/item/editor/EditorItemEstimateCacheAtom";

export type EditorItemEstimateState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly estimate: EditorItemSimulation;
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
	const request = useMemo<EditorItemEstimateCache.Request>(
		() => ({
			itemId,
			quantity: 1,
			snapshot,
			type: "item",
		}),
		[
			itemId,
			snapshot,
		],
	);
	const [state, requestEstimate] = useAtom(EditorItemEstimateCacheAtom);

	useEffect(() => {
		requestEstimate(request);
	}, [
		request,
		requestEstimate,
	]);

	if (!sameSnapshot(state.snapshot, snapshot))
		return {
			status: "loading",
		};
	const estimate = state.estimates.get(itemId)?.get(1);
	if (estimate !== undefined)
		return {
			estimate,
			status: "ready",
		};
	const message = state.errors.get(itemId)?.get(1);
	if (message !== undefined)
		return {
			message,
			status: "error",
		};
	return {
		status: "loading",
	};
};
