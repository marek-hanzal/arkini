import { useAtomSet } from "@effect/atom-react";
import { useEffect } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { ItemEstimateCacheAtom } from "~/estimate/atom/ItemEstimateCacheAtom";
import { useItemEstimateEntrySnapshot } from "~/estimate/ui/useItemEstimateEntrySnapshot";

/** Starts one background Estimate batch when an editor project is entered. */
export const ItemEstimateWarmup = ({ project }: { readonly project: Project }) => {
	const requestEstimateFn = useAtomSet(ItemEstimateCacheAtom);
	const snapshot = useItemEstimateEntrySnapshot(project);
	useEffect(() => {
		requestEstimateFn(snapshot);
	}, [
		requestEstimateFn,
		snapshot,
	]);
	return null;
};
