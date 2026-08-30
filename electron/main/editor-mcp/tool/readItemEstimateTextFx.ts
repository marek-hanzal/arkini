import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { createEditorAcquisitionGraphFn } from "~/flow/fn/createEditorAcquisitionGraphFn";
import type { EstimateRouteStep } from "~/estimate-projection/type/EstimateProjection";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/estimate/type/EditorItemEstimate";
import { estimateEditorItemsFn } from "~/estimate/fn/estimateEditorItemsFn";

const formatNumberFn = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const itemReferenceFn = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const diagnosticTextFn = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "joint-output-accounting-unsupported":
			return `${diagnostic.routeId} exceeds the bounded joint-output accounting state space`;
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} x ${formatNumberFn(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source})`;
		case "cycle":
			return `cycle on ${diagnostic.routeId}: ${diagnostic.factIds.join(" -> ")}`;
		case "unreachable":
			return `${diagnostic.factId} x ${formatNumberFn(diagnostic.quantity)} has no complete route${diagnostic.routeId === undefined ? "" : ` through ${diagnostic.routeId}`}`;
		case "zero-yield":
			return `${diagnostic.routeId} has zero yield for ${diagnostic.factId}`;
	}
};

const amountLinesFn = (
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
						`  - ${itemReferenceFn(project, factId)} x ${formatNumberFn(quantity)}`,
				),
			];

const limitationTextFn = (limitation: EditorItemEstimate["limitations"][number]) => {
	switch (limitation) {
		case "conditional-runtime-adjustments-ignored":
			return "conditional runtime adjustments are ignored";
		case "negative-availability-constraints-ignored":
			return "positive enable prerequisites are acquired, but rule truth and disabling conditions are ignored";
		case "spatial-requirements-approximated":
			return "scope, distance, board capacity, and concrete placement are ignored";
	}
};

const routeLinesFn = (
	project: EditorProject,
	routeSteps: ReadonlyArray<EstimateRouteStep>,
): ReadonlyArray<string> => {
	const routeByFactId = new Map(
		routeSteps.map((route) => [
			route.factId,
			route,
		]),
	);
	return routeSteps.flatMap((route) => [
		`  - ${itemReferenceFn(project, route.factId)} x ${formatNumberFn(route.quantity)} via ${route.routeId} (${route.durationMs / 1_000} s)`,
		...(route.rootQuantity > 0
			? [
					`    authored start contribution: ${formatNumberFn(route.rootQuantity)}`,
				]
			: []),
		...route.requirements.map((requirement) => {
			const acquisition =
				requirement.acquisitionFactId === undefined
					? undefined
					: routeByFactId.get(requirement.acquisitionFactId);
			return `    ${requirement.usage}: ${itemReferenceFn(project, requirement.factId)} x ${formatNumberFn(requirement.quantity)} [${requirement.sources.join(", ")}]${acquisition === undefined ? "" : ` -> ${acquisition.routeId}`}`;
		}),
	]);
};

const formatEstimateFn = (
	project: EditorProject,
	target: EditorProject["config"]["items"][string],
	estimate: EditorItemEstimate,
) => {
	const header = [
		"Item estimate",
		`Item ID: ${target.id}`,
		`Title: ${target.title}`,
		`Quantity: ${formatNumberFn(estimate.quantity)}`,
		"Method: approximate bounded-distribution authored dependency graph",
		"Timing: approximate optimistic parallel critical path",
		"Start facts: authored board, inventory, and toolbar",
		"Output accounting: bounded expected first-hitting time for individual and correlated joint outputs",
		"Route choice: complete quantity-aware upstream critical-path cost with stable route identity ties",
		"Demand: the larger of additive consumption and each route's simultaneous consumed-plus-reusable need",
		"Enable prerequisites: acquired and included in time",
		"Shared witness: finite authored roots and jointly selected co-product operations are credited once",
		"Ignored: rule truth and disabling conditions, scope and placement, concrete item identity packing, renewable capacity",
		"Limitations:",
		...(estimate.limitations.length === 0
			? [
					"  - none",
				]
			: estimate.limitations.map((limitation) => `  - ${limitationTextFn(limitation)}`)),
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
				: estimate.diagnostics.map((diagnostic) => `  - ${diagnosticTextFn(diagnostic)}`)),
		].join("\n");
	return [
		...header,
		"Status: complete",
		`Approximate optimistic parallel duration: ${estimate.durationMs / 1_000} s`,
		`Selected route: ${estimate.route.routeId}`,
		`Approximate action runs: ${formatNumberFn(estimate.route.actionRuns)}`,
		`Approximate output samples: ${formatNumberFn(estimate.route.outputRuns)}`,
		...amountLinesFn(project, "Consumed requirements", estimate.requirementSummary.consumed),
		...amountLinesFn(project, "One-time requirements", estimate.requirementSummary.oneTime),
		...amountLinesFn(project, "Ongoing requirements", estimate.requirementSummary.ongoing),
		"Selected fact DAG:",
		...routeLinesFn(project, estimate.routeSteps),
		"Rejected alternative diagnostics:",
		...(estimate.diagnostics.length === 0
			? [
					"  - none",
				]
			: estimate.diagnostics.map((diagnostic) => `  - ${diagnosticTextFn(diagnostic)}`)),
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
	return formatEstimateFn(project, target, estimate);
});
