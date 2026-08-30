import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { createEditorAcquisitionGraphFn } from "~/flow/fn/createEditorAcquisitionGraphFn";
import type { EstimateRouteStep } from "~/estimate-projection/type/EstimateProjection";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/estimate/type/EditorItemEstimate";
import { estimateEditorItemsFn } from "~/estimate/fn/estimateEditorItemsFn";

const formatNumber = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const itemReference = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const diagnosticText = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "any-of-selection-limit-exceeded":
			return `${diagnostic.routeId} exceeds the static any-of selection limit of ${diagnostic.maximumSelections} normalized demand states`;
		case "retained-demand-not-stable":
			return `${diagnostic.factId} did not stabilize reusable prerequisite demand within ${diagnostic.maximumIterations} witness passes`;
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} x ${formatNumber(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source})`;
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
	routeSteps: ReadonlyArray<EstimateRouteStep>,
): ReadonlyArray<string> => {
	const routeByOccurrenceId = new Map(
		routeSteps.map((route) => [
			route.occurrenceId,
			route,
		]),
	);
	return routeSteps.flatMap((route) => [
		`  - ${itemReference(project, route.factId)} x ${formatNumber(route.quantity)}${route.occurrenceCount > 1 ? ` each across ${formatNumber(route.occurrenceCount)} equivalent occurrences` : ""} via ${route.routeId} (${route.durationMs / 1_000} s per occurrence)`,
		...(route.rootQuantity > 0
			? [
					`    authored start contribution: ${formatNumber(route.rootQuantity)}`,
				]
			: []),
		...route.requirements.map((requirement) => {
			const acquisition =
				requirement.acquisitionOccurrenceId === undefined
					? undefined
					: routeByOccurrenceId.get(requirement.acquisitionOccurrenceId);
			return `    ${requirement.usage}: ${itemReference(project, requirement.factId)} x ${formatNumber(requirement.quantity)} [${requirement.sources.join(", ")}]${acquisition === undefined ? "" : ` -> ${acquisition.routeId}`}`;
		}),
	]);
};

const formatEstimate = (
	project: EditorProject,
	target: EditorProject["config"]["items"][string],
	estimate: EditorItemEstimate,
) => {
	const header = [
		"Item estimate",
		`Item ID: ${target.id}`,
		`Title: ${target.title}`,
		`Quantity: ${formatNumber(estimate.quantity)}`,
		"Method: approximate scalar authored dependency graph",
		"Timing: approximate optimistic parallel critical path",
		"Start facts: authored board, inventory, and toolbar",
		"Random output occurrences: demand divided by scalar expected yield",
		"Route choice: complete scalar upstream cost with stable route identity ties",
		"Quantity boundary: route choice is evaluated at each propagated scalar demand",
		"Any-of boundary: bounded normalized demand states return partial before an incomparable alternative is discarded",
		"Enable prerequisites: acquired and included in time",
		"Independent occurrences: shared outputs and finite roots are not jointly accounted",
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
				? "The bounded static analysis could not produce stable totals; see the diagnostic for the exact limit."
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
		`Approximate optimistic parallel duration: ${estimate.durationMs / 1_000} s`,
		`Selected route: ${estimate.route.routeId}`,
		`Approximate action runs: ${formatNumber(estimate.route.actionRuns)}`,
		`Approximate output samples: ${formatNumber(estimate.route.outputRuns)}`,
		...amountLines(project, "Consumed requirements", estimate.requirementSummary.consumed),
		...amountLines(project, "One-time requirements", estimate.requirementSummary.oneTime),
		...amountLines(project, "Ongoing requirements", estimate.requirementSummary.ongoing),
		"Selected route occurrence groups:",
		...routeLines(project, estimate.routeSteps),
		"Rejected alternative diagnostics:",
		...(estimate.diagnostics.length === 0
			? [
					"  - none",
				]
			: estimate.diagnostics.map((diagnostic) => `  - ${diagnosticText(diagnostic)}`)),
	].join("\n");
};

/** Computes and formats one approximate static item estimate for MCP. */
export const readItemEstimateTextFx = Effect.fn("readItemEstimateTextFx")(function* (
	project: EditorProject,
	itemId: string,
	quantity: number,
) {
	const target = project.config.items[itemId];
	if (target === undefined)
		return yield* Effect.fail(new Error(`Item ${itemId} does not exist in the open project.`));
	const graph = createEditorAcquisitionGraphFn(project.config);
	const estimate = estimateEditorItemsFn({
		graph,
		requests: [
			{
				factId: itemId,
				quantity,
			},
		],
	})[0]!;
	return formatEstimate(project, target, estimate);
});
