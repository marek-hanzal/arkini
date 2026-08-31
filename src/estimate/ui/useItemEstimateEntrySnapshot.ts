import { useRef } from "react";

import type { Project } from "~/project-authoring/type/Project";
import {
	createItemEstimateSnapshotFn,
	type ItemEstimateSnapshot,
} from "~/estimate/fn/createItemEstimateSnapshotFn";

/** Captures one Estimate revision per mounted editor-project entry. */
export const useItemEstimateEntrySnapshot = (project: Project) => {
	const snapshotRef = useRef<ItemEstimateSnapshot | undefined>(undefined);
	if (snapshotRef.current?.projectId !== project.projectId)
		snapshotRef.current = createItemEstimateSnapshotFn(project);
	return snapshotRef.current;
};
