import { Order } from "effect";

import { projectEstimateWitnessFn } from "~/estimate/fn/projectEstimateWitnessFn";
import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";
import { materializeEstimateWitnessesFn } from "~/estimate/fn/materializeEstimateWitnessesFn";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import type { EstimateWitness } from "~/estimate/type/EstimateWitness";
import type { AcquisitionGraph } from "~/flow/type/AcquisitionGraph";

interface EstimateRequestsProps {
	readonly graph: AcquisitionGraph;
	readonly requests: ReadonlyArray<{
		readonly factId: string;
		readonly quantity?: number;
	}>;
}

const maximumDiagnostics = 8;

const isPartialDiagnosticFn = (diagnostic: ItemEstimateDiagnostic) =>
	diagnostic.kind === "joint-output-accounting-unsupported" ||
	diagnostic.kind === "quantity-limit-exceeded" ||
	diagnostic.kind === "witness-search-exhausted";

const uniqueDiagnosticsFn = (
	diagnostics: ReadonlyArray<ItemEstimateDiagnostic>,
): ReadonlyArray<ItemEstimateDiagnostic> => {
	const seen = new Set<string>();
	return diagnostics.filter((diagnostic) => {
		const key = JSON.stringify(diagnostic);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const makeEstimateFn = ({
	diagnostics,
	factId,
	graph,
	quantity,
	witnesses,
}: {
	readonly diagnostics: ReadonlyArray<ItemEstimateDiagnostic>;
	readonly factId: string;
	readonly graph: AcquisitionGraph;
	readonly quantity: number;
	readonly witnesses: ReadonlyArray<EstimateWitness>;
}): ItemEstimate => {
	const uniqueDiagnostics = uniqueDiagnosticsFn(diagnostics);
	const searchExhausted = uniqueDiagnostics.some(
		({ kind }) => kind === "witness-search-exhausted",
	);
	const best = searchExhausted
		? undefined
		: witnesses
				.map((witness) => ({
					projection: projectEstimateWitnessFn(witness),
					witness,
				}))
				.filter(({ projection }) => Number.isFinite(projection.durationMs))
				.sort(
					(left, right) =>
						left.projection.durationMs - right.projection.durationMs ||
						Order.String(left.witness.topRouteId, right.witness.topRouteId),
				)[0];
	if (best !== undefined)
		return {
			diagnostics: uniqueDiagnostics.slice(0, maximumDiagnostics),
			durationMs: best.projection.durationMs,
			factId,
			limitations: graph.limitations,
			obtainable: true,
			quantity,
			requirementSummary: best.projection.requirementSummary,
			route: best.projection.route,
			routeSteps: best.projection.routeSteps,
			status: "complete",
		};

	const boundedDiagnostics = [
		...uniqueDiagnostics,
	]
		.sort(
			(left, right) =>
				Number(isPartialDiagnosticFn(right)) - Number(isPartialDiagnosticFn(left)),
		)
		.slice(0, maximumDiagnostics);
	const resolvedDiagnostics =
		boundedDiagnostics.length > 0
			? boundedDiagnostics
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
		limitations: graph.limitations,
		obtainable: false,
		quantity,
		status: resolvedDiagnostics.some(isPartialDiagnosticFn) ? "partial" : "unreachable",
	};
};

/** Estimates one immutable request batch against a call-local authored dependency policy. */
export const estimateRequestsFn = ({
	graph,
	requests,
}: EstimateRequestsProps): ReadonlyArray<ItemEstimate> => {
	const normalizedRequests = requests.map(({ factId, quantity = 1 }) => ({
		factId,
		quantity,
	}));
	const materialized = materializeEstimateWitnessesFn({
		requests: normalizedRequests,
		topology: createEstimateTopologyFn(graph),
	});
	return materialized.map(({ candidates, diagnostics, factId, quantity }) =>
		makeEstimateFn({
			diagnostics,
			factId,
			graph,
			quantity,
			witnesses: candidates,
		}),
	);
};
