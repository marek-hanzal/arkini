import { match } from "ts-pattern";
import datascript from "datascript";
import { Clock, Effect, Random } from "effect";
import { z } from "zod";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import { GraphOperationReadSchema } from "~/graph/schema/GraphOperationReadSchema";
import { readGraphDiscoveryFn } from "~/graph/fn/readGraphDiscoveryFn";
import { readGraphOperationParticipantsFn } from "~/graph/fn/readGraphOperationParticipantsFn";
import type {
	GraphDiscoveryResult,
	GraphBatchResult,
	GraphOperationReadResult,
} from "~/graph/type/GraphDiscoveryResult";
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

interface Snapshot {
	readonly projectId: string;
	readonly revision: number;
	readonly snapshotId: string;
	readonly configKey: string;
	readonly facts: GraphFacts;
	readonly db: ReturnType<typeof datascript.init_db>;
	readonly operationById: ReadonlyMap<string, number>;
	readonly operationKinds: ReadonlyMap<string, ReadonlySet<number>>;
	readonly owners: ReadonlyMap<string, ReadonlySet<number>>;
	readonly participants: ReadonlyMap<string, ReadonlySet<number>>;
	readonly participantRoles: ReadonlyMap<string, ReadonlySet<number>>;
	readonly roles: ReadonlyMap<string, ReadonlySet<number>>;
}

const CursorSchema = z
	.object({
		snapshotId: z.string(),
		revision: z.number().int().nonnegative(),
		filters: z.string(),
		offset: z.number().int().nonnegative(),
	})
	.strict();
const readCursorFn = (cursor: string) => {
	try {
		return CursorSchema.safeParse(JSON.parse(decodeURIComponent(cursor)));
	} catch {
		return undefined;
	}
};
const filterKeyFn = (query: GraphDiscoveryQuerySchema.Type) =>
	JSON.stringify({
		operationKinds:
			query.operationKinds === undefined
				? null
				: [
						...new Set(query.operationKinds),
					].sort(),
		owner: query.owner ?? null,
		participant: query.participant ?? null,
		role: query.role ?? null,
	});

const readQueryStatusFn = (found: boolean, truncated: boolean): GraphResult["status"] =>
	match({
		found,
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
		.otherwise(() => "no" as const);

/** DataScript owns indexed lookup; this boundary owns revision isolation and bounded traversal. */
export const createProjectGraphFx = Effect.fn("createProjectGraphFx")(
	function* (): Effect.fn.Return<ProjectGraph> {
		const sessionId = `${yield* Random.next}:${yield* Random.next}`;
		let sequence = 0;
		let snapshot: Snapshot | undefined;
		const captureSnapshotFx = (project: Project) =>
			Effect.sync(() => {
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
					const operationById = new Map(
						facts.operations.map((operation, index) => [
							operation.id,
							index,
						]),
					);
					const operationKinds = new Map<string, Set<number>>();
					const owners = new Map<string, Set<number>>();
					const participants = new Map<string, Set<number>>();
					const participantRoles = new Map<string, Set<number>>();
					const roles = new Map<string, Set<number>>();
					const addIndexFn = (
						index: Map<string, Set<number>>,
						key: string,
						value: number,
					) => {
						const values = index.get(key) ?? new Set<number>();
						values.add(value);
						index.set(key, values);
					};
					for (const [index, operation] of facts.operations.entries()) {
						addIndexFn(operationKinds, operation.kind, index);
						addIndexFn(owners, operation.owner, index);
					}
					for (const participant of readGraphOperationParticipantsFn(facts)) {
						const index = operationById.get(participant.operationId)!;
						addIndexFn(participants, participant.nodeId, index);
						addIndexFn(roles, participant.role, index);
						addIndexFn(
							participantRoles,
							JSON.stringify([
								participant.nodeId,
								participant.role,
							]),
							index,
						);
					}
					snapshot = {
						snapshotId: `${sessionId}:${++sequence}`,
						operationById,
						operationKinds,
						owners,
						participants,
						participantRoles,
						roles,
						projectId: project.projectId,
						revision: project.revision,
						configKey,
						facts,
						db,
					};
				}
				return snapshot;
			});
		const runQueryFx = Effect.fn("ProjectGraph.runQueryFx")(function* (
			snapshot: Snapshot,
			query: GraphQuerySchema.Type,
		) {
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
				projectId: snapshot.projectId,
				revision: snapshot.revision,
				status: readQueryStatusFn(found, reasons.size > 0),
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
		const parseInputFx = <T>(
			schema: z.ZodType<T>,
			input: unknown,
		): Effect.Effect<T, GraphQueryError> => {
			const parsed = schema.safeParse(input);
			return parsed.success
				? Effect.succeed(parsed.data)
				: Effect.fail(
						new GraphQueryError({
							reason: "invalid-query",
							message: parsed.error.message,
						}),
					);
		};
		const assertPinsFx = (
			snapshot: Pick<Snapshot, "revision" | "snapshotId">,
			input: {
				revision?: number;
				snapshotId?: string;
			},
		) => {
			if (input.revision !== undefined && input.revision !== snapshot.revision)
				return Effect.fail(
					new GraphQueryError({
						reason: "stale-revision",
						message: `Requested revision ${input.revision}; current project revision is ${snapshot.revision}.`,
					}),
				);
			if (input.snapshotId !== undefined && input.snapshotId !== snapshot.snapshotId)
				return Effect.fail(
					new GraphQueryError({
						reason: "stale-snapshot",
						message:
							"The requested graph snapshot is no longer current. Repeat discovery before continuing or reading operation details.",
					}),
				);
			return Effect.void;
		};
		const queryFx = Effect.fn("ProjectGraph.queryFx")(function* (
			project: Project,
			input: unknown,
		) {
			const query = yield* parseInputFx(GraphQuerySchema, input);
			yield* assertPinsFx(
				{
					revision: project.revision,
					snapshotId: "",
				},
				query,
			);
			const captured = yield* captureSnapshotFx(project);
			return yield* runQueryFx(captured, query);
		});
		const runDiscoveryFx = Effect.fn("ProjectGraph.runDiscoveryFx")(function* (
			captured: Snapshot,
			input: unknown,
		): Effect.fn.Return<GraphDiscoveryResult, GraphQueryError> {
			const query = yield* parseInputFx(GraphDiscoveryQuerySchema, input);
			yield* assertPinsFx(captured, query);
			if (query.kind !== "operations") {
				const editorQuery = yield* parseInputFx(GraphQuerySchema, {
					kind: query.kind,
					from: query.from,
					to: query.to,
					direction: query.direction,
					kinds: query.kinds,
					maxDepth: query.maxDepth,
					limit: query.limit,
					maxExpansions: query.maxExpansions,
					timeoutMs: query.timeoutMs,
					detail: "full",
				});
				const result = yield* runQueryFx(captured, editorQuery);
				return readGraphDiscoveryFn(result, captured.snapshotId, captured.facts);
			}
			for (const nodeId of [
				query.owner,
				query.participant,
			]) {
				if (nodeId !== undefined && datascript.q(NodeQuery, captured.db, nodeId) == null)
					return yield* Effect.fail(
						new GraphQueryError({
							reason: "missing-node",
							message: `Unknown graph node ${nodeId}.`,
						}),
					);
			}
			const filters = filterKeyFn(query);
			let offset = 0;
			if (query.cursor !== undefined) {
				const cursor = readCursorFn(query.cursor);
				if (cursor === undefined || !cursor.success)
					return yield* Effect.fail(
						new GraphQueryError({
							reason: "invalid-query",
							message: "Invalid operation continuation cursor.",
						}),
					);
				yield* assertPinsFx(captured, cursor.data);
				if (cursor.data.filters !== filters)
					return yield* Effect.fail(
						new GraphQueryError({
							reason: "invalid-query",
							message:
								"Operation continuation filters do not match the original query.",
						}),
					);
				offset = cursor.data.offset;
			}
			const indexes: ReadonlySet<number>[] = [];
			if (query.operationKinds !== undefined)
				indexes.push(
					new Set(
						query.operationKinds.flatMap((kind) => [
							...(captured.operationKinds.get(kind) ?? []),
						]),
					),
				);
			if (query.owner !== undefined)
				indexes.push(captured.owners.get(query.owner) ?? new Set());
			if (query.participant !== undefined)
				indexes.push(
					query.role === undefined
						? (captured.participants.get(query.participant) ?? new Set())
						: (captured.participantRoles.get(
								JSON.stringify([
									query.participant,
									query.role,
								]),
							) ?? new Set()),
				);
			else if (query.role !== undefined)
				indexes.push(captured.roles.get(query.role) ?? new Set());
			indexes.sort((a, b) => a.size - b.size);
			const candidates = (
				indexes.length === 0
					? captured.facts.operations.map((_, index) => index)
					: [
							...indexes[0],
						].filter((index) => indexes.every((values) => values.has(index)))
			).sort((a, b) => a - b);
			if (offset > candidates.length)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "invalid-query",
						message: "Operation continuation offset is outside the matching result.",
					}),
				);
			const started = yield* Clock.currentTimeMillis;
			const reasons = new Set<GraphResult["reasons"][number]>();
			const operations: GraphFacts["operations"][number][] = [];
			let expansions = 0;
			let position = offset;
			for (; position < candidates.length; position++) {
				if (operations.length >= query.limit) {
					reasons.add("limit");
					break;
				}
				if (expansions >= query.maxExpansions) {
					reasons.add("expansions");
					break;
				}
				if (expansions % 64 === 0) {
					yield* Effect.yieldNow;
					if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
						reasons.add("timeout");
						break;
					}
				}
				expansions++;
				operations.push(captured.facts.operations[candidates[position]]);
			}
			const result = readGraphDiscoveryFn(
				{
					projectId: captured.projectId,
					revision: captured.revision,
					status: readQueryStatusFn(operations.length > 0, reasons.size > 0),
					truncated: reasons.size > 0,
					reasons: [
						...reasons,
					].sort(),
					expansions,
					nodes: [],
					edges: [],
					operations,
					paths: [],
				},
				captured.snapshotId,
				captured.facts,
			);
			return {
				...result,
				...(position < candidates.length
					? {
							nextCursor: encodeURIComponent(
								JSON.stringify({
									snapshotId: captured.snapshotId,
									revision: captured.revision,
									filters,
									offset: position,
								}),
							),
						}
					: {}),
			};
		});
		const discoveryFx = Effect.fn("ProjectGraph.discoveryFx")(function* (
			project: Project,
			input: unknown,
		) {
			const query = yield* parseInputFx(GraphDiscoveryQuerySchema, input);
			if (query.revision !== undefined && query.revision !== project.revision)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "stale-revision",
						message: `Requested revision ${query.revision}; current project revision is ${project.revision}.`,
					}),
				);
			const captured = yield* captureSnapshotFx(project);
			return yield* runDiscoveryFx(captured, query);
		});
		const batchFx = Effect.fn("ProjectGraph.batchFx")(function* (
			project: Project,
			input: unknown,
		): Effect.fn.Return<GraphBatchResult, GraphQueryError> {
			const request = yield* parseInputFx(GraphBatchQuerySchema, input);
			const captured = yield* captureSnapshotFx(project);
			yield* assertPinsFx(captured, request);
			const nodes = new Map<string, GraphDiscoveryResult["nodes"][number]>();
			const edges = new Map<string, GraphDiscoveryResult["edges"][number]>();
			const operations = new Map<string, GraphDiscoveryResult["operations"][number]>();
			const queries: GraphBatchResult["queries"][number][] = [];
			for (const query of request.queries) {
				const result = yield* Effect.result(runDiscoveryFx(captured, query.query));
				if (result._tag === "Failure") {
					queries.push({
						id: query.id,
						status: "unknown",
						truncated: false,
						reasons: [],
						expansions: 0,
						nodeIds: [],
						edgeIds: [],
						operationIds: [],
						paths: [],
						error: {
							reason: result.failure.reason,
							message: result.failure.message,
						},
					});
					continue;
				}
				const found = result.success;
				for (const node of found.nodes) nodes.set(node.id, node);
				for (const edge of found.edges) edges.set(edge.id, edge);
				for (const operation of found.operations) operations.set(operation.id, operation);
				queries.push({
					id: query.id,
					status: found.status,
					truncated: found.truncated,
					reasons: found.reasons,
					expansions: found.expansions,
					nodeIds: found.nodes.map((node) => node.id),
					edgeIds: found.edges.map((edge) => edge.id),
					operationIds: found.operations.map((operation) => operation.id),
					paths: found.paths,
					...(found.nextCursor === undefined
						? {}
						: {
								nextCursor: found.nextCursor,
							}),
				});
			}
			return {
				projectId: captured.projectId,
				revision: captured.revision,
				snapshotId: captured.snapshotId,
				nodes: [
					...nodes.values(),
				],
				edges: [
					...edges.values(),
				],
				operations: [
					...operations.values(),
				],
				queries,
			};
		});
		const readOperationsFx = Effect.fn("ProjectGraph.readOperationsFx")(function* (
			project: Project,
			input: unknown,
		): Effect.fn.Return<GraphOperationReadResult, GraphQueryError> {
			const request = yield* parseInputFx(GraphOperationReadSchema, input);
			const captured = yield* captureSnapshotFx(project);
			yield* assertPinsFx(captured, request);
			const operations: GraphFacts["operations"][number][] = [];
			const issues: GraphOperationReadResult["issues"][number][] = [];
			for (const operationId of new Set(request.operationIds)) {
				const index = captured.operationById.get(operationId);
				if (index === undefined)
					issues.push({
						operationId,
						reason: "missing-operation",
					});
				else operations.push(captured.facts.operations[index]);
			}
			return structuredClone({
				projectId: captured.projectId,
				revision: captured.revision,
				snapshotId: captured.snapshotId,
				operations,
				issues,
			});
		});

		return {
			queryFx,
			discoveryFx,
			batchFx,
			readOperationsFx,
		};
	},
);
