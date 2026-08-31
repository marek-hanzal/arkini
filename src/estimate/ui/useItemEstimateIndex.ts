import { useAtom } from "@effect/atom-react";
import { useEffect, useMemo } from "react";

import type { Project } from "~/project-authoring/type/Project";
import { createItemEstimateIndexFn } from "~/estimate/fn/createItemEstimateIndexFn";
import type { ItemEstimateIndexRow } from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { selectItemEstimateIndexFn } from "~/estimate/fn/selectItemEstimateIndexFn";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemEstimateCacheAtom } from "~/estimate/atom/ItemEstimateCacheAtom";
import type { ItemEstimateSnapshot } from "~/estimate/fn/createItemEstimateSnapshotFn";
import { useItemEstimateEntrySnapshot } from "~/estimate/ui/useItemEstimateEntrySnapshot";

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

const sameSnapshotFn = (left: ItemEstimateSnapshot | undefined, right: ItemEstimateSnapshot) =>
	left?.projectId === right.projectId && left.revision === right.revision;

/** Reads the shared result of one full-snapshot estimate batch. */
export const useItemEstimateIndex = (
	project: Project,
	{
		itemType,
		query,
		view,
	}: {
		readonly itemType?: TypeSchema.Type;
		readonly query: string;
		readonly view: ItemEstimateViewSchema.Type;
	},
): ItemEstimateIndexState => {
	const snapshot = useItemEstimateEntrySnapshot(project);
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
			itemIds: Object.keys(snapshot.config.items),
		});
		return {
			maximumDemand: Math.max(0, ...entries.map(({ demand }) => demand)),
			rows: selectItemEstimateIndexFn({
				entries,
				itemType,
				items: Object.values(snapshot.config.items),
				query,
				view,
			}),
		};
	}, [
		itemType,
		query,
		snapshot.config.items,
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
