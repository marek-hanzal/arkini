import { Effect } from "effect";
import type { GraphDetailSchema } from "./GraphDetailSchema";

import type { Project } from "~/project-authoring/type/Project";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import type { EstimateRouteStep } from "~/estimate/type/EstimateProjection";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";

const formatNumberFn = (value: number) =>
	Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");

const itemReferenceFn = (project: Project, itemUid: string) => {
	const item = project.config.items[itemUid];
	return item === undefined ? `${itemUid} [missing]` : `${item.uid} [${item.title}]`;
};

const diagnosticTextFn = (diagnostic: ItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "template-reset-unsupported":
			return `${diagnostic.routeId} replaces its owner space with a template, which static Estimate cannot simulate`;
		case "weighted-clock-pool-unsupported":
			return `${diagnostic.routeId} depends on weighted Clock alternatives whose shared pulse timing static Estimate cannot resolve.`;
		case "finite-owner-lifetime-unsupported":
			return `${diagnostic.routeId} depends on a finite owner lifetime that static estimation cannot settle`;
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
	project: Project,
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

const limitationTextFn = (limitation: ItemEstimate["limitations"][number]) => {
	switch (limitation) {
		case "template-resets-not-simulated":
			return "template board replacement and its created or removed items are not simulated";
		case "conditional-runtime-adjustments-ignored":
			return "conditional runtime adjustments are ignored";
		case "negative-availability-constraints-ignored":
			return "positive enable prerequisites are acquired, but rule truth and disabling conditions are ignored";
		case "spatial-requirements-approximated":
			return "query reach, board capacity, and concrete placement are ignored";
	}
};

const routeLinesFn = (
	project: Project,
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
	project: Project,
	target: Project["config"]["items"][string],
	estimate: ItemEstimate,
) => {
	const header = [
		"Item estimate",
		`Item UID: ${target.uid}`,
		`Title: ${target.title}`,
		`Quantity: ${formatNumberFn(estimate.quantity)}`,
		"Method: approximate bounded-distribution authored dependency graph",
		"Timing: approximate optimistic parallel critical path",
		"Start facts: authored board",
		"Outcome accounting: bounded expected first-hitting time for individual and correlated joint outputs",
		"Route choice: complete quantity-aware upstream critical-path cost with stable route identity ties",
		"Demand: the larger of additive consumption and each route's simultaneous consumed-plus-reusable need",
		"Enable prerequisites: acquired and included in time",
		"Shared witness: finite authored roots and jointly selected co-product operations are credited once",
		"Ignored: rule truth and disabling conditions, query reach and placement, concrete item identity packing, renewable capacity",
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
		`Approximate outcome samples: ${formatNumberFn(estimate.route.outputRuns)}`,
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

/** Diagnostics are bounded by the estimator, so they cannot establish a total rejected-route count. */
const formatSummaryFn = (
	project: Project,
	target: Project["config"]["items"][string],
	estimate: ItemEstimate,
) => {
	const diagnostic = estimate.diagnostics[0];
	const reason =
		diagnostic === undefined
			? "No complete acquisition route"
			: diagnostic.kind === "witness-search-exhausted"
				? `${diagnostic.routeId} exhausted the bounded witness search (${diagnostic.maximumStates} states)`
				: diagnosticTextFn(diagnostic);
	const reasons = new Map<string, number>();
	const routes = new Set<string>();
	for (const diagnostic of estimate.diagnostics) {
		reasons.set(diagnostic.kind, (reasons.get(diagnostic.kind) ?? 0) + 1);
		if ("routeId" in diagnostic && diagnostic.routeId !== undefined)
			routes.add(diagnostic.routeId);
	}
	return [
		"Item estimate",
		`Item UID: ${target.uid}`,
		`Title: ${target.title}`,
		`Quantity: ${formatNumberFn(estimate.quantity)}`,
		"Detail: summary",
		`Status: ${estimate.status}`,
		"Method: authored dependency graph, optimistic parallel critical path",
		...(estimate.obtainable
			? [
					`Approximate optimistic parallel duration: ${estimate.durationMs / 1_000} s`,
					`Selected route: ${estimate.route.routeId}`,
					`Approximate action runs: ${formatNumberFn(estimate.route.actionRuns)}`,
					`Approximate outcome samples: ${formatNumberFn(estimate.route.outputRuns)}`,
					...amountLinesFn(
						project,
						"Consumed requirements",
						estimate.requirementSummary.consumed,
					),
					...amountLinesFn(
						project,
						"One-time requirements",
						estimate.requirementSummary.oneTime,
					),
					...amountLinesFn(
						project,
						"Ongoing requirements",
						estimate.requirementSummary.ongoing,
					),
				]
			: [
					"Duration and selected route: unresolved; no stable complete totals",
					`Reason: ${reason}`,
				]),
		`Rejected alternative diagnostics (reported): ${estimate.diagnostics.length}; distinct diagnosed routes: ${routes.size}`,
		`Reasons: ${
			[
				...reasons,
			]
				.map(([kind, count]) => `${kind} x${count}`)
				.join(", ") || "none reported"
		}`,
		`Cycles: ${reasons.has("cycle") ? "encountered" : "none reported"}`,
		"Diagnostics are bounded; total rejected alternatives and unreported cycles are unknown.",
		`Limitations: ${estimate.limitations.map(limitationTextFn).join("; ") || "none"}`,
	].join("\n");
};

/** Computes and formats one approximate static item estimate for MCP. */
export const readItemEstimateTextFx = Effect.fn("readItemEstimateTextFx")(function* (
	project: Project,
	itemUid: string,
	quantity: number,
	detail: GraphDetailSchema.Type = "full",
) {
	const target = project.config.items[itemUid];
	if (target === undefined)
		return yield* Effect.fail(new Error(`Item ${itemUid} does not exist in the open project.`));
	const graph = createAcquisitionGraphFn(project.config);
	const estimate = estimateRequestsFn({
		graph,
		requests: [
			{
				factId: itemUid,
				quantity,
			},
		],
	})[0]!;
	return detail === "summary"
		? formatSummaryFn(project, target, estimate)
		: formatEstimateFn(project, target, estimate);
});
