import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createEditorItemEstimateIndexFx } from "~/editor/createEditorItemEstimateIndexFx";
import type { EditorItemEstimateIndexEntry } from "~/editor/EditorItemEstimateIndex";
import {
	EditorItemEstimateCacheAtom,
	type EditorItemEstimateCacheAtom as EditorItemEstimateCache,
} from "~/ui/item/editor/makeEditorItemEstimateCacheAtomFx";

export type EditorItemEstimateIndexState =
	| {
			readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
			readonly status: "loading";
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

/** Reads the shared result of one full-snapshot estimate batch. */
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
	const [state, requestIndex] = useAtom(EditorItemEstimateCacheAtom);

	useEffect(() => {
		requestIndex(snapshot);
	}, [
		requestIndex,
		snapshot,
	]);
	const entries = useMemo(
		() =>
			RendererRuntime.runSync(
				createEditorItemEstimateIndexFx({
					estimates: state.estimates,
					itemIds: Object.keys(project.config.items),
				}),
			),
		[
			project.config.items,
			state.estimates,
		],
	);
	if (!sameSnapshot(state.snapshot, snapshot))
		return {
			entries: [],
			status: "loading",
		};
	if (state.status === "loading" || state.status === "idle")
		return {
			entries,
			status: "loading",
		};
	if (state.status === "error")
		return {
			entries,
			message: state.message ?? "Estimate calculation failed.",
			status: "error",
		};
	return {
		entries,
		status: "ready",
	};
};
