import { useRef } from "react";

import type { Project } from "~/project-authoring/type/Project";
import {
	createItemEstimateSnapshotFn,
	type ItemEstimateSnapshot,
} from "~/estimate/fn/createItemEstimateSnapshotFn";

/** Captures one Estimate revision per editor-project entry or explicit refresh. */
export const useItemEstimateEntrySnapshot = (project: Project, refreshVersion = 0) => {
	const refreshVersionRef = useRef(refreshVersion);
	const snapshotRef = useRef<ItemEstimateSnapshot | undefined>(undefined);
	if (
		snapshotRef.current?.projectId !== project.projectId ||
		refreshVersionRef.current !== refreshVersion
	) {
		snapshotRef.current = createItemEstimateSnapshotFn(project);
		refreshVersionRef.current = refreshVersion;
	}
	return snapshotRef.current;
};
