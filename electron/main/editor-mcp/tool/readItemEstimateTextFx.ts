import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRouteStep,
} from "~/editor/estimator/EditorItemEstimate";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";

const formatNumber = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const itemReference = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const diagnosticText = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} x ${formatNumber(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source})`;
		case "joint-output-accounting-unsupported":
			return `correlated output demand on ${diagnostic.routeId} exceeds the bounded static state space`;
		case "cycle":
			return `cycle on ${diagnostic.routeId}: ${diagnostic.factIds.join(" -> ")}`;
		case "unreachable":
			return `${diagnostic.factId} x ${formatNumber(diagnostic.quantity)} has no complete route${diagnostic.routeId === undefined ? "" : ` through ${diagnostic.routeId}`}`;
		case "zero-yield":
			return `${diagnostic.routeId} has zero yield for ${diagnostic.factId}`;
	}
};

const amountLines = (
	project: EditorProject,
	title: string,
	amounts: ReadonlyArray<{
		readonly factId: string;
		readonly quantity: number;
	}>,
): ReadonlyArray<string> =>
	amounts.length === 0
		? []
		: [
				`${title}:`,
				...amounts.map(
					({ factId, quantity }) =>
						`  - ${itemReference(project, factId)} x ${formatNumber(quantity)}`,
				),
			];

const limitationText = (limitation: EditorItemEstimate["limitations"][number]) => {
	switch (limitation) {
		case "conditional-runtime-adjustments-ignored":
			return "conditional runtime adjustments are ignored";
		case "negative-availability-constraints-ignored":
			return "positive enable prerequisites are acquired, but rule truth and disabling conditions are ignored";
		case "spatial-requirements-approximated":
			return "scope, distance, board capacity, and concrete placement are ignored";
	}
};

const routeLines = (
	project: EditorProject,
	routeSteps: ReadonlyArray<EditorItemEstimateRouteStep>,
): ReadonlyArray<string> => {
	const routeByFactId = new Map(
		routeSteps.map((route) => [
			route.factId,
			route,
		]),
	);
	return routeSteps.flatMap((route) => [
		`  - ${itemReference(project, route.factId)} x ${formatNumber(route.quantity)} via ${route.routeId} (${route.durationMs / 1_000} s)`,
		...(route.rootQuantity > 0
			? [
					`    authored start contribution: ${formatNumber(route.rootQuantity)}`,
				]
			: []),
		...route.requirements.map((requirement) => {
			const acquisition =
				requirement.acquisitionFactId === undefined
					? undefined
					: routeByFactId.get(requirement.acquisitionFactId);
			return `    ${requirement.usage}: ${itemReference(project, requirement.factId)} x ${formatNumber(requirement.quantity)} [${requirement.sources.join(", ")}]${acquisition === undefined ? "" : ` -> ${acquisition.routeId}`}`;
		}),
	]);
};

const formatEstimate = (project: EditorProject, estimate: EditorItemEstimate) => {
	const target = project.config.items[estimate.factId];
	if (target === undefined)
		throw new Error(`Item ${estimate.factId} does not exist in the open project.`);
	const header = [
		"Item estimate",
		`Item ID: ${target.id}`,
		`Title: ${target.title}`,
		`Quantity: ${formatNumber(estimate.quantity)}`,
		"Method: static authored dependency graph",
		"Timing: optimistic parallel critical path",
		"Start facts: authored board, inventory, and toolbar",
		"Random output occurrences: expected-run economics",
		"Enable prerequisites: acquired and included in time",
		"Ignored: rule truth and disabling conditions, scope and placement, charge capacity and renewal, finite resource capacity",
		"Limitations:",
		...(estimate.limitations.length === 0
			? [
					"  - none",
				]
			: estimate.limitations.map((limitation) => `  - ${limitationText(limitation)}`)),
	];
	if (!estimate.obtainable)
		return [
			...header,
			`Status: ${estimate.status}`,
			estimate.status === "partial"
				? "The authored path exceeds a bounded static-analysis limit; duration is indeterminate."
				: "No complete acquisition route reaches the target from the authored start facts.",
			"Diagnostics:",
			...(estimate.diagnostics.length === 0
				? [
						"  - target has no acquisition route",
					]
				: estimate.diagnostics.map((diagnostic) => `  - ${diagnosticText(diagnostic)}`)),
		].join("\n");
	return [
		...header,
		"Status: complete",
		`Optimistic parallel duration: ${estimate.durationMs / 1_000} s`,
		`Selected route: ${estimate.route.routeId}`,
		`Expected action runs: ${formatNumber(estimate.route.actionRuns)}`,
		`Expected output samples: ${formatNumber(estimate.route.outputRuns)}`,
		...amountLines(project, "Consumed requirements", estimate.requirementSummary.consumed),
		...amountLines(project, "One-time requirements", estimate.requirementSummary.oneTime),
		...amountLines(project, "Ongoing requirements", estimate.requirementSummary.ongoing),
		"Selected route graph:",
		...routeLines(project, estimate.routeSteps),
		"Rejected alternative diagnostics:",
		...(estimate.diagnostics.length === 0
			? [
					"  - none",
				]
			: estimate.diagnostics.map((diagnostic) => `  - ${diagnosticText(diagnostic)}`)),
	].join("\n");
};

/** Computes and formats one bounded static item estimate for MCP. */
export const readItemEstimateTextFx = Effect.fn("readItemEstimateTextFx")(function* (
	project: EditorProject,
	itemId: string,
	quantity: number,
) {
	const graph = yield* createEditorAcquisitionGraphFx(project.config);
	const estimate = yield* estimateEditorItemFx({
		factId: itemId,
		graph,
		quantity,
	});
	return formatEstimate(project, estimate);
});
