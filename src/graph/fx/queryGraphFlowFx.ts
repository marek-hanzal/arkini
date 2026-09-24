import { Clock, Effect } from "effect";
import { match } from "ts-pattern";
import { GraphQueryError } from "~/graph/error/GraphQueryError";
import type { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import type { GraphFlow, GraphFlowIndex, GraphFlowResult } from "~/graph/type/GraphFlow";

/** Breadth-first operation paths preserve alternative occurrences without solving prerequisite inventory. */
export const queryGraphFlowFx = Effect.fn("queryGraphFlowFx")(function* (
	index: GraphFlowIndex,
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
	const initial: GraphFlow = {
		nodes: [
			query.from,
		],
		steps: [],
	};
	const flows: GraphFlow[] =
		query.from === query.to
			? [
					initial,
				]
			: [];
	const pending: GraphFlow[] =
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
		for (const step of index.outgoing.get(current) ?? []) {
			if (query.operationKinds !== undefined && !query.operationKinds.includes(step.kind))
				continue;
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
			if (path.nodes.includes(step.to)) continue;
			if (path.steps.length >= query.maxDepth) {
				reasons.add("depth");
				continue;
			}
			const next: GraphFlow = {
				nodes: [
					...path.nodes,
					step.to,
				],
				steps: [
					...path.steps,
					step,
				],
			};
			if (step.to === query.to) {
				if (flows.length >= query.limit) {
					reasons.add("limit");
					break search;
				}
				flows.push(next);
			} else pending.push(next);
		}
	}
	const truncated = reasons.size > 0;
	return structuredClone({
		flows,
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
