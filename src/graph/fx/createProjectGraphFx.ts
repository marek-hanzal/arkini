import datascript from "datascript";
import { Clock, Effect } from "effect";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import { GraphQueryError } from "~/graph/error/GraphQueryError";
import type { GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { ProjectGraph } from "~/graph/type/ProjectGraph";
import type { Project } from "~/project-authoring/type/Project";

const DirectionRules = {
	out: '[[(adjacent ?e ?node ?next) [?e "edge/from" ?node] [?e "edge/to" ?next]]]',
	in: '[[(adjacent ?e ?node ?next) [?e "edge/to" ?node] [?e "edge/from" ?next]]]',
	both: '[[(adjacent ?e ?node ?next) [?e "edge/from" ?node] [?e "edge/to" ?next]] [(adjacent ?e ?node ?next) [?e "edge/to" ?node] [?e "edge/from" ?next]]]',
} as const;
const AdjacentQuery =
	'[:find ?index ?next :in $ % ?node :where (adjacent ?e ?node ?next) [?e "edge/index" ?index]]';
const NodeQuery = '[:find ?index . :in $ ?id :where [?n "node/id" ?id] [?n "node/index" ?index]]';

/** DataScript owns indexed lookup; this boundary owns revision isolation and bounded traversal. */
export const createProjectGraphFx = Effect.fn("createProjectGraphFx")(
	function* (): Effect.fn.Return<ProjectGraph> {
		let snapshot:
			| {
					readonly projectId: string;
					readonly revision: number;
					readonly configKey: string;
					readonly facts: GraphFacts;
					readonly db: ReturnType<typeof datascript.init_db>;
			  }
			| undefined;
		const queryFx = Effect.fn("ProjectGraph.queryFx")(function* (
			project: Project,
			input: unknown,
		) {
			const parsed = GraphQuerySchema.safeParse(input);
			if (!parsed.success)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "invalid-query",
						message: parsed.error.message,
					}),
				);
			const query = parsed.data;
			if (query.revision !== undefined && query.revision !== project.revision)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "stale-revision",
						message: `Requested revision ${query.revision}; current project revision is ${project.revision}.`,
					}),
				);
			// Hard Refresh can rematerialize edited files without changing the persisted marker.
			// Comparing serialized authoring data is much cheaper than rebuilding DataScript.
			const configKey = JSON.stringify(project.config);
			if (
				snapshot?.projectId !== project.projectId ||
				snapshot.revision !== project.revision ||
				snapshot.configKey !== configKey
			) {
				// Snapshot data is detached from caller-owned config and never returned by reference.
				const facts = compileGraphFactsFn(structuredClone(project.config));
				const datoms: [
					number,
					string,
					unknown,
				][] = [];
				let entity = 1;
				const entityFn = (attributes: Readonly<Record<string, unknown>>) => {
					for (const [attribute, value] of Object.entries(attributes))
						if (value !== undefined)
							datoms.push([
								entity,
								attribute,
								value,
							]);
					entity++;
				};
				for (const [index, node] of facts.nodes.entries())
					entityFn({
						"node/id": node.id,
						"node/index": index,
						"node/kind": node.kind,
					});
				for (const operation of facts.operations)
					entityFn({
						"operation/id": operation.id,
						"operation/owner": operation.owner,
						"operation/kind": operation.kind,
					});
				for (const [index, edge] of facts.edges.entries())
					entityFn({
						"edge/index": index,
						"edge/id": edge.id,
						"edge/from": edge.from,
						"edge/to": edge.to,
						"edge/kind": edge.kind,
						"edge/operation": edge.operationId,
						"edge/set": edge.annotations.setId,
						"edge/roll": edge.annotations.rollId,
					});
				const db = datascript.init_db(datoms, {
					"node/id": {
						":db/unique": ":db.unique/identity",
					},
					"edge/from": {
						":db/index": true,
					},
					"edge/to": {
						":db/index": true,
					},
				});
				snapshot = {
					projectId: project.projectId,
					revision: project.revision,
					configKey,
					facts,
					db,
				};
			}
			// Capture before yielding: another request may replace the session's cached revision.
			const { facts, db } = snapshot;
			const rootIndex = datascript.q(NodeQuery, db, query.from) as number | null;
			if (rootIndex === null || rootIndex === undefined)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "missing-node",
						message: `Unknown graph node ${query.from}.`,
					}),
				);
			if (query.to !== undefined && datascript.q(NodeQuery, db, query.to) == null)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "missing-node",
						message: `Unknown graph node ${query.to}.`,
					}),
				);
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
			const pending = [
				{
					nodes: [
						query.from,
					],
					edges: [] as string[],
				},
			];
			const visited = new Set([
				query.from,
			]);
			if (query.kind === "path" && found) paths.push(pending[0]);
			search: for (
				let cursor = 0;
				query.kind !== "node" && cursor < pending.length;
				cursor++
			) {
				if (query.kind === "path" && query.detail === "summary" && found) break;
				const path = pending[cursor];
				const current = path.nodes[path.nodes.length - 1];
				const adjacent = (
					datascript.q(AdjacentQuery, db, DirectionRules[query.direction], current) as [
						number,
						string,
					][]
				)
					.filter(
						([index]) =>
							query.kinds === undefined ||
							query.kinds.includes(facts.edges[index].kind),
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
						if (
							query.kind === "path"
								? !path.nodes.includes(next)
								: !selected.has(index)
						)
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
				projectId: project.projectId,
				revision: project.revision,
				status: found ? "yes" : reasons.size > 0 ? "unknown" : "no",
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
		return {
			queryFx,
		};
	},
);
