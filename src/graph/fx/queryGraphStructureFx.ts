import { Clock, Effect } from "effect";
import { match, P } from "ts-pattern";
import { GraphQueryError } from "~/graph/error/GraphQueryError";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { GraphFacts, GraphNode } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";

/** Bounded structural traversal over authored edge occurrences, independent of session state. */
export const queryGraphStructureFx = Effect.fn("queryGraphStructureFx")(function* ({
	facts,
	nodes,
	projectId,
	revision,
	query,
	adjacentFn,
}: queryGraphStructureFx.Props): Effect.fn.Return<GraphResult, GraphQueryError> {
	for (const nodeId of [
		query.from,
		query.to,
	]) {
		if (nodeId !== undefined && !nodes.has(nodeId))
			return yield* Effect.fail(
				new GraphQueryError({
					reason: "missing-node",
					message: `Unknown graph node ${nodeId}.`,
				}),
			);
	}
	const started = yield* Clock.currentTimeMillis;
	const reasons = new Set<GraphResult["reasons"][number]>();
	const selected = new Set<number>();
	const nodeIds = new Set([
		query.from,
	]);
	const paths: {
		nodes: string[];
		edges: string[];
	}[] = [];
	let expansions = 0;
	let found = query.kind === "node" || (query.kind === "path" && query.from === query.to);
	const initial = {
		nodes: [
			query.from,
		],
		edges: [] as string[],
	};
	const pending = found
		? []
		: [
				initial,
			];
	const visited = new Set([
		query.from,
	]);
	if (query.kind === "path" && found) paths.push(initial);
	search: for (let cursor = 0; cursor < pending.length; cursor++) {
		const path = pending[cursor];
		const current = path.nodes[path.nodes.length - 1];
		const adjacent = [
			...adjacentFn(current),
		]
			.filter(
				([index]) =>
					query.kinds === undefined || query.kinds.includes(facts.edges[index].kind),
			)
			.sort(([a], [b]) => a - b);
		for (const [index, next] of adjacent) {
			if (expansions >= query.maxExpansions) {
				reasons.add("expansions");
				break search;
			}
			expansions++;
			if (expansions % 64 === 1) {
				yield* Effect.yieldNow;
				if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
					reasons.add("timeout");
					break search;
				}
			}
			const edge = facts.edges[index];
			if (query.kind === "connections" && query.to !== undefined && next !== query.to)
				continue;
			if (path.edges.length >= query.maxDepth) {
				if (query.kind === "path" ? !path.nodes.includes(next) : !selected.has(index))
					reasons.add("depth");
				continue;
			}
			const nextPath = {
				nodes: [
					...path.nodes,
					next,
				],
				edges: [
					...path.edges,
					edge.id,
				],
			};
			if (query.kind === "path") {
				if (next === query.to) {
					found = true;
					if (paths.length >= query.limit) {
						reasons.add("limit");
						break search;
					}
					paths.push(nextPath);
					if (query.detail === "summary") break search;
				}
				if (!path.nodes.includes(next) && next !== query.to) pending.push(nextPath);
			} else {
				if (!selected.has(index) && selected.size >= query.limit) {
					reasons.add("limit");
					break search;
				}
				selected.add(index);
				nodeIds.add(next);
				found = true;
				if (query.kind === "traverse" && !visited.has(next)) {
					visited.add(next);
					pending.push(nextPath);
					paths.push(nextPath);
				}
			}
		}
		if (query.kind === "connections") break;
	}
	if (query.kind === "path") {
		const edgeIds = new Set(paths.flatMap((path) => path.edges));
		for (const [index, edge] of facts.edges.entries())
			if (edgeIds.has(edge.id)) selected.add(index);
		for (const path of paths) for (const node of path.nodes) nodeIds.add(node);
	}
	const edges = [
		...selected,
	]
		.sort((a, b) => a - b)
		.map((index) => facts.edges[index]);
	const operationIds = new Set(edges.map((edge) => edge.operationId));
	const operations =
		query.detail === "summary"
			? []
			: facts.operations.filter(
					(operation) =>
						operationIds.has(operation.id) ||
						(query.kind === "node" && operation.owner === query.from),
				);
	if (query.kind === "node" && operations.length > query.limit) reasons.add("limit");
	const compactPath = query.kind === "path" && query.detail === "summary";
	const result: GraphResult = {
		projectId,
		revision,
		status: match([
			found,
			reasons.size > 0,
		])
			.with(
				[
					true,
					P._,
				],
				() => "yes" as const,
			)
			.with(
				[
					false,
					true,
				],
				() => "unknown" as const,
			)
			.otherwise(() => "no" as const),
		truncated: reasons.size > 0,
		reasons: [
			...reasons,
		].sort(),
		expansions,
		nodes: compactPath ? [] : facts.nodes.filter((node) => nodeIds.has(node.id)),
		edges: compactPath ? [] : edges,
		operations: query.kind === "node" ? operations.slice(0, query.limit) : operations,
		paths: query.detail === "summary" ? [] : paths,
	};
	return structuredClone(result);
});
export namespace queryGraphStructureFx {
	export interface Props {
		readonly facts: GraphFacts;
		readonly nodes: ReadonlyMap<string, GraphNode>;
		readonly projectId: string;
		readonly revision: number;
		readonly query: GraphQuerySchema.Type;
		readonly adjacentFn: (nodeId: string) => readonly (readonly [
			number,
			string,
		])[];
	}
}
