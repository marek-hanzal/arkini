import { Effect } from "effect";

import { createEditorItemEstimateIndexFx } from "~/editor/createEditorItemEstimateIndexFx";
import type { EditorProject } from "~/editor/EditorProject";
import { estimateEditorItemsFx } from "~/editor/estimateEditorItemsFx";
import { selectEditorItemEstimateIndexFx } from "~/editor/selectEditorItemEstimateIndexFx";
import type { EditorMcpEstimateInput } from "./EditorMcpEstimateInputSchema";

const formatNumber = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const estimateLabel = ({
	runtimeMs,
	status,
}: {
	readonly runtimeMs?: number;
	readonly status: "complete" | "partial" | "unreachable";
}) => {
	if (status === "partial") return "Partial";
	if (status === "unreachable") return "No path";
	return runtimeMs === undefined ? "—" : `${formatNumber(runtimeMs / 1_000)} s`;
};

const demandRatioLabel = (demand: number, maximumDemand: number) => {
	const percentage = maximumDemand <= 0 ? 0 : (demand / maximumDemand) * 100;
	if (percentage <= 0.1) return "negligible";
	return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
};

/** Computes, selects, pages, and formats the global Estimate projection for MCP. */
export const readEditorMcpEstimateTextFx = Effect.fn("readEditorMcpEstimateTextFx")(function* (
	project: EditorProject,
	input: EditorMcpEstimateInput,
) {
	const estimates = yield* estimateEditorItemsFx(project.config);
	const entries = yield* createEditorItemEstimateIndexFx({
		estimates: new Map(
			estimates.map((estimate) => [
				estimate.factId,
				estimate,
			]),
		),
		itemIds: Object.keys(project.config.items),
	});
	const rows = yield* selectEditorItemEstimateIndexFx({
		entries,
		items: Object.values(project.config.items),
		query: input.query ?? "",
		sort: input.sort,
	});
	const maximumDemand = Math.max(0, ...entries.map(({ demand }) => demand));
	const pageRows = rows.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
	const totalPages = Math.ceil(rows.length / input.pageSize);
	const hasPreviousPage = input.page > 1;
	const hasNextPage = input.page * input.pageSize < rows.length;
	return [
		"Global estimate",
		"Method: static authored dependency graph",
		"Timing: optimistic parallel critical path",
		"Quantity: 1 of every item",
		"Demand: aggregate selected-route quantity across every obtainable item estimate",
		`Sort: ${input.sort}`,
		...(input.query === undefined
			? []
			: [
					`Query: ${input.query}`,
				]),
		`Project items: ${entries.length}`,
		`Matched items: ${rows.length}`,
		`Page: ${input.page}`,
		`Total pages: ${totalPages}`,
		`Page size: ${input.pageSize}`,
		`Returned items: ${pageRows.length}`,
		`Has previous page: ${hasPreviousPage}`,
		`Has next page: ${hasNextPage}`,
		...(hasPreviousPage
			? [
					`Previous page: ${input.page - 1}`,
				]
			: []),
		...(hasNextPage
			? [
					`Next page: ${input.page + 1}`,
				]
			: []),
		"",
		"Items:",
		pageRows.length === 0
			? "- none"
			: pageRows
					.map(({ estimate, item }) =>
						[
							`- ${item.title}`,
							`  ID: ${item.id}`,
							`  Status: ${estimate.status}`,
							`  Estimate: ${estimateLabel(estimate)}`,
							`  Demand: ${formatNumber(estimate.demand)} (${demandRatioLabel(estimate.demand, maximumDemand)})`,
						].join("\n"),
					)
					.join("\n\n"),
	].join("\n");
});
