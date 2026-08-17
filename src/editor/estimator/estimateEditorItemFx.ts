import { Effect } from "effect";

import type { EditorAcquisitionGraph } from "~/editor/EditorAcquisitionGraph";
import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type {
	EditorItemEstimate,
	EditorItemEstimateAmount,
	EditorItemEstimateRejectedRoute,
} from "~/editor/estimator/EditorItemEstimate";
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
const maximumRejectedRoutes = 32;
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

const freezeAmounts = (
	quantities: ReadonlyMap<string, number>,
): ReadonlyArray<EditorItemEstimateAmount> =>
	Object.freeze(
		[
			...quantities,
		]
			.filter(([, quantity]) => quantity > 1e-9)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([factId, quantity]) => ({
				factId,
				quantity,
			})),
	);

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
		consumables: [],
		diagnostics: [],
		durationMs: 0,
		factId,
		limitations,
		obtainable: true,
		status: "complete",
		oneTimeRequirements: [],
		ongoingRequirements: [],
		quantity,
		rejectedRoutes: [],
		route,
		routeSteps: [
			route,
		],
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
					rejectedRoutes: [],
				} satisfies EditorItemEstimate;
			let policy = policyByGraph.get(graph);
			if (policy === undefined) {
				policy = yield* createEditorEstimatePolicyFx(graph);
				policyByGraph.set(graph, policy);
			}
			if (!(quantity > 0) || !policy.factIds.has(factId))
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
					rejectedRoutes: [],
				} satisfies EditorItemEstimate;
			const root = policy.roots.get(factId);
			if (root === "unbounded" || (root ?? 0) >= quantity)
				return makeRootEstimate(factId, quantity, graph.limitations);

			const plans: Array<{
				readonly plan: EditorEstimateCandidatePlan;
				readonly routeId: string;
			}> = [];
			const rejectedRoutes: EditorItemEstimateRejectedRoute[] = [];
			let hasPartialCandidate = false;
			for (const route of policy.routesByFact.get(factId) ?? []) {
				const candidate = yield* materializeEditorEstimatePlanFx({
					factId,
					policy,
					quantity,
					topRoute: route,
				});
				if ("diagnostics" in candidate) {
					if (
						candidate.diagnostics.some(
							({ kind }) =>
								kind === "availability-condition-unsupported" ||
								kind === "charge-accounting-unsupported" ||
								kind === "charge-renewal-unsupported" ||
								kind === "finite-root-interaction-unsupported" ||
								kind === "joint-output-accounting-unsupported" ||
								kind === "quantity-limit-exceeded",
						)
					)
						hasPartialCandidate = true;
					if (rejectedRoutes.length < maximumRejectedRoutes)
						rejectedRoutes.push({
							diagnostics: candidate.diagnostics.slice(0, maximumDiagnostics),
							routeId: route.id,
						});
				} else
					plans.push({
						plan: candidate,
						routeId: route.id,
					});
			}
			plans.sort(
				(left, right) =>
					left.plan.durationMs - right.plan.durationMs ||
					left.routeId.localeCompare(right.routeId),
			);
			const selected = plans[0]?.plan;
			if (selected === undefined) {
				const diagnostics = uniqueDiagnostics(
					rejectedRoutes.flatMap((route) => route.diagnostics),
				)
					.sort(
						(left, right) =>
							Number(right.kind === "charge-renewal-unsupported") -
								Number(left.kind === "charge-renewal-unsupported") ||
							Number(right.kind.endsWith("-unsupported")) -
								Number(left.kind.endsWith("-unsupported")),
					)
					.slice(0, maximumDiagnostics);
				return {
					diagnostics:
						diagnostics.length > 0
							? diagnostics
							: [
									{
										factId,
										kind: "unreachable",
										quantity,
									},
								],
					factId,
					limitations: graph.limitations,
					obtainable: false,
					status: hasPartialCandidate ? "partial" : "unreachable",
					quantity,
					rejectedRoutes,
				} satisfies EditorItemEstimate;
			}
			return {
				consumables: freezeAmounts(selected.consumables),
				diagnostics: [],
				durationMs: selected.durationMs,
				factId,
				limitations: graph.limitations,
				obtainable: true,
				status: "complete",
				oneTimeRequirements: freezeAmounts(selected.oneTime),
				ongoingRequirements: freezeAmounts(selected.ongoing),
				quantity,
				rejectedRoutes: [
					...rejectedRoutes,
					...selected.rejectedRoutes,
				].slice(0, maximumRejectedRoutes),
				route: selected.projection.route,
				routeSteps: selected.projection.routeSteps,
			} satisfies EditorItemEstimate;
		}),
);
