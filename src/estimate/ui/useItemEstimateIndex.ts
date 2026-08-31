import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { createItemEstimateIndexFn } from "~/estimate/fn/createItemEstimateIndexFn";
import type { ItemEstimateIndexRow } from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { selectItemEstimateIndexFn } from "~/estimate/fn/selectItemEstimateIndexFn";
import {
	ItemEstimateCacheAtom,
	type ItemEstimateCacheAtom as ItemEstimateCache,
} from "~/estimate/atom/ItemEstimateCacheAtom";

export type ItemEstimateIndexState =
	| {
			readonly maximumDemand: number;
			readonly rows: ReadonlyArray<ItemEstimateIndexRow>;
			readonly status: "loading";
	  }
	| {
			readonly maximumDemand: number;
			readonly rows: ReadonlyArray<ItemEstimateIndexRow>;
			readonly status: "ready";
	  }
	| {
			readonly maximumDemand: number;
			readonly message: string;
			readonly rows: ReadonlyArray<ItemEstimateIndexRow>;
			readonly status: "error";
	  };

const sameSnapshotFn = (
	left: ItemEstimateCache.Snapshot | undefined,
	right: ItemEstimateCache.Snapshot,
) => left?.projectId === right.projectId && left.revision === right.revision;

/** Reads the shared result of one full-snapshot estimate batch. */
export const useItemEstimateIndex = (
	project: Project,
	{
		query,
		view,
	}: {
		readonly query: string;
		readonly view: ItemEstimateViewSchema.Type;
	},
): ItemEstimateIndexState => {
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
	const [state, requestIndexFn] = useAtom(ItemEstimateCacheAtom);

	useEffect(() => {
		requestIndexFn(snapshot);
	}, [
		requestIndexFn,
		snapshot,
	]);
	const selection = useMemo(() => {
		const entries = createItemEstimateIndexFn({
			estimates: state.estimates,
			itemIds: Object.keys(project.config.items),
		});
		return {
			maximumDemand: Math.max(0, ...entries.map(({ demand }) => demand)),
			rows: selectItemEstimateIndexFn({
				entries,
				items: Object.values(project.config.items),
				query,
				view,
			}),
		};
	}, [
		project.config.items,
		query,
		view,
		state.estimates,
	]);
	if (!sameSnapshotFn(state.snapshot, snapshot))
		return {
			maximumDemand: 0,
			rows: [],
			status: "loading",
		};
	if (state.status === "loading" || state.status === "idle")
		return {
			...selection,
			status: "loading",
		};
	if (state.status === "error")
		return {
			...selection,
			message: state.message ?? "Estimate calculation failed.",
			status: "error",
		};
	return {
		...selection,
		status: "ready",
	};
};
