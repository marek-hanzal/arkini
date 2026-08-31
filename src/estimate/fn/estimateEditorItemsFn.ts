import { Order } from "effect";

import { projectEstimateWitnessFn } from "~/estimate-projection/fn/projectEstimateWitnessFn";
import { createEstimateTopologyFn } from "~/estimate/fn/createEstimateTopologyFn";
import { materializeEstimateWitnessesFn } from "~/estimate/fn/materializeEstimateWitnessesFn";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/estimate/type/EditorItemEstimate";
import type { EstimateWitness } from "~/estimate-witness/type/EstimateWitness";
import type { EditorAcquisitionGraph } from "~/flow/type/EditorAcquisitionGraph";

interface EstimateEditorItemsProps {
	readonly graph: EditorAcquisitionGraph;
	readonly requests: ReadonlyArray<{
		readonly factId: string;
		readonly quantity?: number;
	}>;
}

const maximumDiagnostics = 8;

const isPartialDiagnosticFn = (diagnostic: EditorItemEstimateDiagnostic) =>
	diagnostic.kind === "joint-output-accounting-unsupported" ||
	diagnostic.kind === "quantity-limit-exceeded" ||
	diagnostic.kind === "witness-search-exhausted";

const uniqueDiagnosticsFn = (
	diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>,
): ReadonlyArray<EditorItemEstimateDiagnostic> => {
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
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly factId: string;
	readonly graph: EditorAcquisitionGraph;
	readonly quantity: number;
	readonly witnesses: ReadonlyArray<EstimateWitness>;
}): EditorItemEstimate => {
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
export const estimateEditorItemsFn = ({
	graph,
	requests,
}: EstimateEditorItemsProps): ReadonlyArray<EditorItemEstimate> => {
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
