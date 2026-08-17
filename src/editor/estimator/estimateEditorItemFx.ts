import { Effect } from "effect";

import type { EditorEstimateDependencyGraph } from "~/editor/estimator/EditorEstimateDependencyGraph";
import type { EditorEstimatePolicy } from "~/editor/estimator/createEditorEstimatePolicyFx";
import { createEditorEstimatePolicyFx } from "~/editor/estimator/createEditorEstimatePolicyFx";
import type {
	EditorItemEstimate,
	EditorItemEstimateAmount,
	EditorItemEstimateRejectedRoute,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorEstimateCandidatePlan } from "~/editor/estimator/materializeEditorEstimatePlanFx";
import { materializeEditorEstimatePlanFx } from "~/editor/estimator/materializeEditorEstimatePlanFx";

export namespace estimateEditorItemFx {
	export interface Props {
		readonly factId: string;
		readonly graph: EditorEstimateDependencyGraph;
		readonly quantity?: number;
	}
}

const maximumDiagnostics = 8;
const maximumRejectedRoutes = 32;
const policyByGraph = new WeakMap<EditorEstimateDependencyGraph, EditorEstimatePolicy>();

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
	limitations: EditorEstimateDependencyGraph["limitations"],
): EditorItemEstimate => ({
	consumables: [],
	diagnostics: [],
	durationMs: 0,
	factId,
	limitations,
	obtainable: true,
	oneTimeRequirements: [],
	ongoingRequirements: [],
	quantity,
	rejectedRoutes: [],
	route: {
		actionRuns: 0,
		durationMs: 0,
		factId,
		outputRuns: 0,
		quantity,
		requirements: [],
		rootQuantity: quantity,
		routeId: `root:${factId}`,
		source: "root",
	},
});

export const estimateEditorItemFx = Effect.fn("estimateEditorItemFx")(
	({ factId, graph, quantity = 1 }: estimateEditorItemFx.Props) =>
		Effect.gen(function* () {
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
			for (const route of policy.routesByFact.get(factId) ?? []) {
				const candidate = yield* materializeEditorEstimatePlanFx({
					factId,
					policy,
					quantity,
					topRoute: route,
				});
				if ("diagnostics" in candidate) {
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
				const diagnostics = rejectedRoutes
					.flatMap((route) => route.diagnostics)
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
				oneTimeRequirements: freezeAmounts(selected.oneTime),
				ongoingRequirements: freezeAmounts(selected.ongoing),
				quantity,
				rejectedRoutes: [
					...rejectedRoutes,
					...selected.rejectedRoutes,
				].slice(0, maximumRejectedRoutes),
				route: selected.node,
			} satisfies EditorItemEstimate;
		}),
);
