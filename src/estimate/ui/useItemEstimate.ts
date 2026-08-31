import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { Project } from "~/project-authoring/type/Project";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ItemEstimateCacheAtom } from "~/estimate/atom/ItemEstimateCacheAtom";
import type { ItemEstimateSnapshot } from "~/estimate/fn/createItemEstimateSnapshotFn";
import { useItemEstimateEntrySnapshot } from "~/estimate/ui/useItemEstimateEntrySnapshot";

export type ItemEstimateState =
	| {
			readonly status: "loading";
	  }
	| {
			readonly config: GameConfigSchema.Type;
			readonly estimate: ItemEstimate;
			readonly status: "ready";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };

const sameSnapshotFn = (left: ItemEstimateSnapshot | undefined, right: ItemEstimateSnapshot) =>
	left?.projectId === right.projectId && left.revision === right.revision;

/** Reads a cached estimate or requests one from the renderer-owned estimate authority. */
export const useItemEstimate = (project: Project, itemId: string): ItemEstimateState => {
	const snapshot = useItemEstimateEntrySnapshot(project);
	const [state, requestEstimateFn] = useAtom(ItemEstimateCacheAtom);

	useEffect(() => {
		requestEstimateFn(snapshot);
	}, [
		requestEstimateFn,
		snapshot,
	]);

	if (!sameSnapshotFn(state.snapshot, snapshot))
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
			config: snapshot.config,
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
