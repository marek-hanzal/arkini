import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import {
	ItemEstimateCacheAtom,
	type ItemEstimateCacheAtom as ItemEstimateCache,
} from "~/estimate/ui/ItemEstimateCacheAtom";

export type ItemEstimateState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly estimate: ItemEstimate;
			readonly status: "ready";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

const sameSnapshot = (
	left: ItemEstimateCache.Snapshot | undefined,
	right: ItemEstimateCache.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

/** Reads a cached estimate or requests one from the renderer-owned estimate authority. */
export const useItemEstimate = (project: EditorProject, itemId: string): ItemEstimateState => {
	const snapshot = useMemo<ItemEstimateCache.Snapshot>(
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
	const [state, requestEstimate] = useAtom(ItemEstimateCacheAtom);

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
