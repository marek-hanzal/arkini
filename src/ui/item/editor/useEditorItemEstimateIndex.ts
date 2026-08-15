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
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly status: "loading";
			readonly total: number;
	  }
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly status: "ready";
	  }
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly message: string;
			readonly status: "error";
	  };

const sameSnapshot = (
	left: EditorItemEstimateCache.Snapshot | undefined,
	right: EditorItemEstimateCache.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

const projectEntries = (
	state: EditorItemEstimateCache.State,
	project: EditorProject,
): ReadonlyArray<EditorItemEstimateIndexEntry> =>
	Object.keys(project.config.items)
		.flatMap((itemId) => {
			const estimate = state.estimates.get(itemId)?.get(1);
			return estimate === undefined
				? []
				: [
						{
							itemId,
							method: "engine-backed" as const,
							runtimeMs: estimate.runtimeMs,
							status: estimate.status,
						},
					];
		})
		.sort((left, right) => left.itemId.localeCompare(right.itemId));

/** Reads authoritative cached results while the same process-lifetime queue fills missing items. */
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
			entries: [],
			status: "loading",
			total: Object.keys(project.config.items).length,
		};
	const entries = projectEntries(state, project);
	const errors = Object.keys(project.config.items).flatMap((itemId) => {
		const message = state.errors.get(itemId)?.get(1);
		return message === undefined
			? []
			: [
					message,
				];
	});
	const total = Object.keys(project.config.items).length;
	const completed = state.progress.completed;
	if (completed < total || !state.hydrated)
		return {
			completed,
			entries,
			status: "loading",
			total,
		};
	if (errors.length > 0)
		return {
			entries,
			message: `${errors.length} item estimate${errors.length === 1 ? "" : "s"} failed.`,
			status: "error",
		};
	return {
		entries,
		status: "ready",
	};
};
