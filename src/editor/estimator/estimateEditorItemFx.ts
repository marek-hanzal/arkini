import { Effect } from "effect";

import type { EditorAcquisitionGraph } from "~/editor/EditorAcquisitionGraph";
import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type { EditorItemEstimate } from "~/editor/estimator/EditorItemEstimate";
import type { EditorEstimateCandidatePlan } from "~/editor/estimator/materializeEditorEstimatePlanFx";
import { materializeEditorEstimatePlanFx } from "~/editor/estimator/materializeEditorEstimatePlanFx";
import { editorItemEstimateMaximumQuantity } from "~/editor/estimator/EditorItemEstimateQuantitySchema";

export namespace estimateEditorItemFx {
	export interface Props {
		readonly factId: string;
		readonly graph: EditorAcquisitionGraph;
		readonly quantity?: number;
	}
}

const maximumDiagnostics = 8;
const policyByGraph = new WeakMap<EditorAcquisitionGraph, EditorEstimatePolicy>();

const uniqueDiagnostics = (
	diagnostics: ReadonlyArray<EditorItemEstimate["diagnostics"][number]>,
) => {
	const seen = new Set<string>();
	return diagnostics.filter((diagnostic) => {
		const key = JSON.stringify(diagnostic);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const makeRootEstimate = (
	factId: string,
	quantity: number,
	limitations: EditorAcquisitionGraph["limitations"],
): EditorItemEstimate => {
	const route = {
		actionRuns: 0,
		durationMs: 0,
		factId,
		outputRuns: 0,
		quantity,
		requirements: [],
		rootQuantity: quantity,
		routeId: `root:${factId}`,
		source: "root" as const,
	};
	return {
		diagnostics: [],
		durationMs: 0,
		factId,
		limitations,
		obtainable: true,
		status: "complete",
		quantity,
		route,
		routeSteps: [
			route,
		],
	};
};

const makeCompleteEstimate = (
	factId: string,
	quantity: number,
	limitations: EditorAcquisitionGraph["limitations"],
	plan: EditorEstimateCandidatePlan,
): EditorItemEstimate => ({
	diagnostics: [],
	durationMs: plan.durationMs,
	factId,
	limitations,
	obtainable: true,
	status: "complete",
	quantity,
	route: plan.projection.route,
	routeSteps: plan.projection.routeSteps,
});

const makeUnavailableEstimate = (
	factId: string,
	quantity: number,
	limitations: EditorAcquisitionGraph["limitations"],
	candidateDiagnostics: ReadonlyArray<EditorItemEstimate["diagnostics"][number]>,
): EditorItemEstimate => {
	const diagnostics = uniqueDiagnostics(candidateDiagnostics)
		.sort(
			(left, right) =>
				Number(right.kind.endsWith("-unsupported")) -
				Number(left.kind.endsWith("-unsupported")),
		)
		.slice(0, maximumDiagnostics);
	const resolvedDiagnostics =
		diagnostics.length > 0
			? diagnostics
			: [
					{
						factId,
						kind: "unreachable" as const,
						quantity,
					},
				];
	return {
		diagnostics: resolvedDiagnostics,
		factId,
		limitations,
		obtainable: false,
		status: resolvedDiagnostics.some(
			({ kind }) =>
				kind === "joint-output-accounting-unsupported" ||
				kind === "quantity-limit-exceeded",
		)
			? "partial"
			: "unreachable",
		quantity,
	};
};

export const estimateEditorItemFx = Effect.fn("estimateEditorItemFx")(
	({ factId, graph, quantity = 1 }: estimateEditorItemFx.Props) =>
		Effect.gen(function* () {
			if (quantity > editorItemEstimateMaximumQuantity)
				return {
					diagnostics: [
						{
							factId,
							kind: "quantity-limit-exceeded",
							maximumQuantity: editorItemEstimateMaximumQuantity,
							quantity,
							source: "request",
						},
					],
					factId,
					limitations: graph.limitations,
					obtainable: false,
					status: "partial",
					quantity,
				} satisfies EditorItemEstimate;
			let policy = policyByGraph.get(graph);
			if (policy === undefined) {
				policy = yield* createEditorEstimatePolicyFx(graph);
				policyByGraph.set(graph, policy);
			}
			if (!(quantity > 0) || !(yield* policy.hasFactFx(factId)))
				return {
					diagnostics: [
						{
							factId,
							kind: "unreachable",
							quantity,
						},
					],
					factId,
					limitations: graph.limitations,
					obtainable: false,
					status: "unreachable",
					quantity,
				} satisfies EditorItemEstimate;
			const root = yield* policy.readRootQuantityFx(factId);
			if (root === "unbounded" || (root ?? 0) >= quantity)
				return makeRootEstimate(factId, quantity, graph.limitations);

			const candidates = yield* Effect.forEach(
				yield* policy.readCandidateRoutesFx(factId),
				(topRoute) =>
					Effect.map(
						materializeEditorEstimatePlanFx({
							factId,
							policy,
							quantity,
							topRoute,
						}),
						(candidate) => ({
							candidate,
							routeId: topRoute.id,
						}),
					),
			);
			const bestPlan = candidates
				.flatMap(({ candidate, routeId }) =>
					"diagnostics" in candidate
						? []
						: [
								{
									plan: candidate,
									routeId,
								},
							],
				)
				.sort(
					(left, right) =>
						left.plan.durationMs - right.plan.durationMs ||
						left.routeId.localeCompare(right.routeId),
				)[0]?.plan;
			if (bestPlan !== undefined)
				return makeCompleteEstimate(factId, quantity, graph.limitations, bestPlan);
			return makeUnavailableEstimate(
				factId,
				quantity,
				graph.limitations,
				candidates.flatMap(({ candidate }) =>
					"diagnostics" in candidate ? candidate.diagnostics : [],
				),
			);
		}),
);
