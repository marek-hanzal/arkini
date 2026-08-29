import type { EditorProject } from "~/editor/EditorProject";
import { createEditorItemEstimateIndexFn } from "~/editor/estimator/fn/createEditorItemEstimateIndexFn";
import { estimateEditorItemCatalogFn } from "~/editor/estimator/fn/estimateEditorItemCatalogFn";
import { selectEditorItemEstimateIndexFn } from "~/editor/estimator/fn/selectEditorItemEstimateIndexFn";
import type { EstimateInput } from "../EstimateInputSchema";

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
	return runtimeMs === undefined ? "—" : `~${formatNumber(runtimeMs / 1_000)} s`;
};

const demandRatioLabel = (demand: number, maximumDemand: number) => {
	const percentage = maximumDemand <= 0 ? 0 : (demand / maximumDemand) * 100;
	if (percentage <= 0.1) return "negligible";
	return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
};

/** Computes, selects, pages, and formats the global Estimate projection for MCP. */
export const readEstimateTextFn = (project: EditorProject, input: EstimateInput) => {
	const estimates = estimateEditorItemCatalogFn(project.config);
	const entries = createEditorItemEstimateIndexFn({
		estimates: new Map(
			estimates.map((estimate) => [
				estimate.factId,
				estimate,
			]),
		),
		itemIds: Object.keys(project.config.items),
	});
	const rows = selectEditorItemEstimateIndexFn({
		entries,
		incomplete: input.incomplete,
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
		"Method: approximate scalar authored dependency graph",
		"Timing: approximate optimistic parallel critical path",
		"Route choice: first locally ranked route when each fact becomes reachable; scalar action time with stable route identity ties",
		"Quantity: 1 of every item",
		"Demand: aggregate approximate route-occurrence quantity across every obtainable item estimate",
		`Incomplete only: ${input.incomplete}`,
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
};
