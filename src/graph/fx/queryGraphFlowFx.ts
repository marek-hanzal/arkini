import { Clock, Effect } from "effect";
import { match } from "ts-pattern";
import { readGraphFlowEvidenceFn } from "~/graph/fn/readGraphFlowEvidenceFn";
import { GraphQueryError } from "~/graph/error/GraphQueryError";
import type { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import type { GraphFlow, GraphFlowResult } from "~/graph/type/GraphFlow";
import type { GraphEdge } from "~/graph/type/GraphFacts";
import type { GraphIndexedOperation, GraphOperationIndex } from "~/graph/type/GraphOperationIndex";

interface FlowPath {
	readonly nodes: readonly string[];
	readonly steps: readonly {
		readonly from: string;
		readonly entry: GraphIndexedOperation;
		readonly output: GraphEdge;
	}[];
}

/** Breadth-first authored paths: each step stays inside one operation, without gameplay evaluation. */
export const queryGraphFlowFx = Effect.fn("queryGraphFlowFx")(function* (
	index: GraphOperationIndex,
	query: GraphFlowQuerySchema.Type,
): Effect.fn.Return<GraphFlowResult, GraphQueryError> {
	for (const node of [
		query.from,
		query.to,
	])
		if (!index.nodes.has(node))
			return yield* Effect.fail(
				new GraphQueryError({
					reason: "missing-node",
					message: `Unknown graph node ${node}.`,
				}),
			);
	const initial: FlowPath = {
		nodes: [
			query.from,
		],
		steps: [],
	};
	const flows: FlowPath[] =
		query.from === query.to
			? [
					initial,
				]
			: [];
	const pending: FlowPath[] =
		query.from === query.to
			? []
			: [
					initial,
				];
	const reasons = new Set<GraphFlowResult["reasons"][number]>();
	const started = yield* Clock.currentTimeMillis;
	let expansions = 0;
	search: for (let cursor = 0; cursor < pending.length; cursor++) {
		const path = pending[cursor];
		const current = path.nodes[path.nodes.length - 1];
		for (const entry of index.outgoing.get(current) ?? []) {
			if (
				query.operationKinds !== undefined &&
				!query.operationKinds.includes(entry.operation.kind)
			)
				continue;
			for (const output of entry.outputs) {
				if (expansions >= query.maxExpansions) {
					reasons.add("expansions");
					break search;
				}
				if (expansions % 64 === 0) {
					yield* Effect.yieldNow;
					if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
						reasons.add("timeout");
						break search;
					}
				}
				expansions++;
				if (path.nodes.includes(output.to)) continue;
				if (path.steps.length >= query.maxDepth) {
					reasons.add("depth");
					continue;
				}
				// Only a remaining candidate makes a full result page incomplete.
				if (flows.length >= query.limit) {
					reasons.add("limit");
					break search;
				}
				const next: FlowPath = {
					nodes: [
						...path.nodes,
						output.to,
					],
					steps: [
						...path.steps,
						{
							from: current,
							entry,
							output,
						},
					],
				};
				if (output.to === query.to) flows.push(next);
				else pending.push(next);
			}
		}
	}
	const truncated = reasons.size > 0;
	return structuredClone({
		// Render facts only for returned paths; unsuccessful search branches retain cheap references.
		flows: flows.map(
			(path): GraphFlow => ({
				nodes: path.nodes,
				steps: path.steps.map(({ from, entry, output }) => ({
					from,
					to: output.to,
					operationId: entry.operation.id,
					kind: entry.operation.kind,
					owner: entry.operation.owner,
					evidence: readGraphFlowEvidenceFn(
						entry.operation,
						output,
						entry.sources.find((source) => source.node === from)!.role,
						entry.sources.map((source) => source.node),
						index.nodes,
					),
				})),
			}),
		),
		status: match({
			found: flows.length > 0,
			truncated,
		})
			.with(
				{
					found: true,
				},
				() => "yes" as const,
			)
			.with(
				{
					truncated: true,
				},
				() => "unknown" as const,
			)
			.otherwise(() => "no" as const),
		truncated,
		reasons: [
			...reasons,
		].sort(),
		expansions,
	});
});
