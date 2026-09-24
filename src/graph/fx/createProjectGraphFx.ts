import { compileGraphAuditFn } from "~/graph/fn/compileGraphAuditFn";
import { queryGraphAuditFx } from "~/graph/fx/queryGraphAuditFx";
import type { GraphAuditIndex } from "~/graph/type/GraphAudit";
import { match } from "ts-pattern";
import datascript from "datascript";
import { Clock, Effect, Random } from "effect";
import { z } from "zod";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";
import { readGraphOperationSummaryFn } from "~/graph/fn/readGraphOperationSummaryFn";
import type { GraphDiscoveryOperation } from "~/graph/type/GraphDiscoveryResult";
import { compileGraphFactsFn } from "~/graph/fn/compileGraphFactsFn";
import type { GraphOperationsQuerySchema } from "~/graph/schema/GraphOperationsQuerySchema";
import { compileGraphOperationIndexFn } from "~/graph/fn/compileGraphOperationIndexFn";
import { aggregateGraphOperationsFx } from "~/graph/fx/aggregateGraphOperationsFx";
import { queryGraphStructureFx } from "~/graph/fx/queryGraphStructureFx";
import { queryGraphFlowFx } from "~/graph/fx/queryGraphFlowFx";
import type { GraphOperationIndex } from "~/graph/type/GraphOperationIndex";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import { GraphOperationReadSchema } from "~/graph/schema/GraphOperationReadSchema";
import { readGraphDiscoveryFn } from "~/graph/fn/readGraphDiscoveryFn";

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

interface Snapshot {
	readonly projectId: string;
	readonly revision: number;
	readonly snapshotId: string;
	readonly configKey: string;
	readonly facts: GraphFacts;
	readonly db: ReturnType<typeof datascript.init_db>;
	readonly searchNodesFn: (query: string) => readonly number[];
	readonly operationIndex: GraphOperationIndex;
	readonly auditIndex: GraphAuditIndex;
	readonly operationReferences: readonly string[];
	readonly operationByReference: ReadonlyMap<string, number>;
	readonly operationSummaries: readonly GraphDiscoveryOperation[];
	readonly discoveryIndex: readGraphDiscoveryFn.Index;
	readonly searchOperationsFn: (
		search: NonNullable<GraphOperationsQuerySchema.Type["search"]>,
	) => readonly number[];
	readonly operationById: ReadonlyMap<string, number>;
	readonly operationKinds: ReadonlyMap<string, ReadonlySet<number>>;
	readonly owners: ReadonlyMap<string, ReadonlySet<number>>;
	readonly participants: ReadonlyMap<string, ReadonlySet<number>>;
	readonly participantRoles: ReadonlyMap<string, ReadonlySet<number>>;
	readonly roles: ReadonlyMap<string, ReadonlySet<number>>;
}

interface Continuation {
	readonly snapshotId: string;
	readonly revision: number;
	readonly filters: string;
	readonly offset: number;
	readonly auditAnalysis?: queryGraphAuditFx.Result;
}
const ContinuationLimit = 1024;
const readOperationFilterFn = (
	operation: GraphDiscoveryOperation,
	filter: GraphOperationsQuerySchema.Type["filter"],
) => {
	if (filter === undefined) return true;
	return Object.entries(filter).every(([key, expected]) => {
		if (expected === undefined) return true;
		if (!Object.hasOwn(operation, key)) return false;
		const actual = operation[key as keyof GraphDiscoveryOperation];
		if (typeof expected !== "object") return actual === expected;
		return (
			typeof actual === "number" &&
			(expected.min === undefined || actual >= expected.min) &&
			(expected.max === undefined || actual <= expected.max) &&
			(expected.gt === undefined || actual > expected.gt) &&
			(expected.lt === undefined || actual < expected.lt)
		);
	});
};

/** Reference substitution belongs only to discovery; canonical facts retain their exact identities. */
const readOperationReferencesFn = (
	result: GraphDiscoveryResult,
	snapshot: Snapshot,
): GraphDiscoveryResult => {
	const referenceFn = (id: string) =>
		snapshot.operationReferences[snapshot.operationById.get(id)!];
	return {
		...result,
		operations: result.operations.map((operation) => ({
			...operation,
			id: referenceFn(operation.id),
		})),
		edges: result.edges.map((edge) =>
			edge.operationId === undefined
				? edge
				: {
						...edge,
						operationId: referenceFn(edge.operationId),
					},
		),
		...(result.flows === undefined
			? {}
			: {
					flows: result.flows.map((flow) => ({
						...flow,
						steps: flow.steps.map((step) => ({
							...step,
							operationId: referenceFn(step.operationId),
						})),
					})),
				}),
		...(result.audit === undefined
			? {}
			: {
					audit: {
						...result.audit,
						matches: result.audit.matches.map((entry) => ({
							...entry,
							facts: entry.facts.map((fact) =>
								fact.kind === "template"
									? fact
									: {
											...fact,
											operationIds: fact.operationIds.map(referenceFn),
										},
							),
						})),
					},
				}),
		...(result.matches === undefined
			? {}
			: {
					matches: result.matches.map((entry) => ({
						...entry,
						operationId: referenceFn(entry.operationId),
					})),
				}),
	};
};

type PagedQuery = Extract<
	GraphDiscoveryQuerySchema.Type,
	{
		kind: "operations" | "connections" | "audit";
	}
>;
const filterKeyFn = (query: PagedQuery): string =>
	JSON.stringify(
		match(query)
			.with(
				{
					kind: "connections",
				},
				(query) => ({
					kind: query.kind,
					from: query.from,
					to: query.to ?? null,
					direction: query.direction,
					kinds:
						query.kinds === undefined
							? null
							: [
									...new Set(query.kinds),
								].sort(),
				}),
			)
			.with(
				{
					kind: "operations",
				},
				(query) => ({
					kind: query.kind,
					operationKinds:
						query.operationKinds === undefined
							? null
							: [
									...new Set(query.operationKinds),
								].sort(),
					owner: query.owner ?? null,
					participant: query.participant ?? null,
					role: query.role ?? null,
					search: query.search ?? null,
					filter: query.filter ?? null,
					aggregate: query.aggregate ?? null,
				}),
			)
			.with(
				{
					kind: "audit",
				},
				(query) => ({
					kind: query.kind,
					audit: query.audit,
					mode: query.mode,
				}),
			)
			.exhaustive(),
	);

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
		const sessionId = [
			yield* Random.next,
			yield* Random.next,
		]
			.map((value) =>
				Math.floor(value * 0x100000000)
					.toString(36)
					.padStart(7, "0"),
			)
			.join("");
		const continuations = new Map<string, Continuation>();
		let continuationSequence = 0;
		const issueContinuationFx = (continuation: Continuation) =>
			Effect.sync(() => {
				const token = `c_${sessionId}_${(++continuationSequence).toString(36)}`;
				continuations.set(token, continuation);
				if (continuations.size > ContinuationLimit)
					continuations.delete(continuations.keys().next().value!);
				return token;
			});
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
					for (const [index, edge] of facts.edges.entries())
						entityFn({
							"edge/index": index,
							"edge/from": edge.from,
							"edge/to": edge.to,
						});
					const db = datascript.init_db(datoms, {
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
					const operationIndex = compileGraphOperationIndexFn(facts);
					const operationParticipants = operationIndex.participants;
					for (const participant of operationParticipants) {
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
					const snapshotId = `${sessionId}_${(++sequence).toString(36)}`;
					const operationReferences = facts.operations.map(
						(_, index) => `op_${snapshotId}_${index.toString(36)}`,
					);
					const operationByReference = new Map(
						operationReferences.map((reference, index) => [
							reference,
							index,
						]),
					);
					const nodeTitles = new Map(
						facts.nodes.map((node) => [
							node.id,
							node.title,
						]),
					);
					const operationSummaries = facts.operations.map((operation) =>
						readGraphOperationSummaryFn(
							operation,
							nodeTitles.get(operation.owner) ?? operation.owner,
						),
					);
					const participantTitles = new Map<string, Set<string>>();
					for (const participant of operationParticipants) {
						const titles =
							participantTitles.get(participant.operationId) ?? new Set<string>();
						titles.add(nodeTitles.get(participant.nodeId) ?? participant.nodeId);
						participantTitles.set(participant.operationId, titles);
					}
					const documents = operationSummaries.map((operation, index) => ({
						index,
						title: operation.title,
						owner: nodeTitles.get(operation.owner) ?? operation.owner,
						participants: [
							...(participantTitles.get(operation.id) ?? []),
						],
					}));
					const titleSearchFn = createFuzzySearchFn({
						candidates: documents.map((document) => ({
							terms: [
								document.title,
							],
							value: document.index,
						})),
					});
					const ownerSearchFn = createFuzzySearchFn({
						candidates: documents.map((document) => ({
							terms: [
								document.owner,
							],
							value: document.index,
						})),
					});
					const participantSearchFn = createFuzzySearchFn({
						candidates: documents.map((document) => ({
							terms: document.participants,
							value: document.index,
						})),
					});
					const allSearchFn = createFuzzySearchFn({
						candidates: documents.map((document) => ({
							terms: [
								document.title,
								document.owner,
							],
							relatedTerms: document.participants,
							value: document.index,
						})),
					});
					const searchOperationsFn: Snapshot["searchOperationsFn"] = (search) =>
						match(search.scope)
							.with("title", () => titleSearchFn(search.text))
							.with("owner", () => ownerSearchFn(search.text))
							.with("participant", () => participantSearchFn(search.text))
							.with("all", () => allSearchFn(search.text))
							.exhaustive();
					snapshot = {
						snapshotId,
						searchNodesFn: createFuzzySearchFn({
							candidates: facts.nodes.map((node, index) => ({
								terms: [
									node.title,
									node.id,
									node.id.slice(node.id.indexOf(":") + 1),
								],
								value: index,
							})),
						}),
						operationIndex,
						auditIndex: compileGraphAuditFn(facts, operationIndex),
						operationReferences,
						operationByReference,
						operationSummaries,
						discoveryIndex: {
							nodes: operationIndex.nodes,
							edges: new Map(
								facts.edges.map((edge) => [
									edge.id,
									edge,
								]),
							),
							operations: new Map(
								operationSummaries.map((operation) => [
									operation.id,
									operation,
								]),
							),
						},
						searchOperationsFn,
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
		const runQueryFx = (snapshot: Snapshot, query: GraphQuerySchema.Type) =>
			queryGraphStructureFx({
				facts: snapshot.facts,
				nodes: snapshot.operationIndex.nodes,
				projectId: snapshot.projectId,
				revision: snapshot.revision,
				query,
				adjacentFn: (nodeId) =>
					datascript.q(
						AdjacentQuery,
						snapshot.db,
						DirectionRules[query.direction],
						nodeId,
					) as [
						number,
						string,
					][],
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
		const readContinuationFx = Effect.fn("ProjectGraph.readContinuationFx")(function* (
			captured: Snapshot,
			token: string | undefined,
			filters: string,
		) {
			if (token === undefined) return undefined;
			const cursor = continuations.get(token);
			if (cursor === undefined)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "invalid-query",
						message: "Unknown or expired graph continuation cursor. Repeat discovery.",
					}),
				);
			yield* assertPinsFx(captured, cursor);
			if (cursor.filters !== filters)
				return yield* Effect.fail(
					new GraphQueryError({
						reason: "invalid-query",
						message: "Graph continuation filters do not match the original query.",
					}),
				);
			return cursor;
		});

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
			if (query.kind === "search") {
				const matches = captured
					.searchNodesFn(query.query)
					.filter(
						(index) =>
							query.nodeKinds === undefined ||
							query.nodeKinds.includes(captured.facts.nodes[index].kind),
					);
				const truncated = matches.length > query.limit;
				return {
					projectId: captured.projectId,
					revision: captured.revision,
					snapshotId: captured.snapshotId,
					status: readQueryStatusFn(matches.length > 0, truncated),
					truncated,
					reasons: truncated
						? [
								"limit",
							]
						: [],
					expansions: 0,
					nodes: matches.slice(0, query.limit).map((index) => {
						const node = captured.facts.nodes[index];
						return {
							id: node.id,
							title: node.title,
							kind: node.kind,
							...(node.clock === undefined
								? {}
								: {
										clock: {
											...node.clock,
										},
									}),
							...(node.missing
								? {
										missing: true,
									}
								: {}),
						};
					}),
					edges: [],
					operations: [],
					paths: [],
				};
			}
			if (query.kind === "audit") {
				const filters = filterKeyFn(query);
				const continuation = yield* readContinuationFx(captured, query.cursor, filters);
				const analysis =
					continuation?.auditAnalysis ??
					(yield* queryGraphAuditFx(captured.auditIndex, query));
				const offset = continuation?.offset ?? 0;
				const matches =
					query.mode === "count"
						? []
						: analysis.audit.matches.slice(offset, offset + query.limit);
				const hasMore =
					query.mode === "list" &&
					offset + matches.length < analysis.audit.matches.length;
				const nextCursor = hasMore
					? yield* issueContinuationFx({
							snapshotId: captured.snapshotId,
							revision: captured.revision,
							filters,
							offset: offset + matches.length,
							auditAnalysis: analysis,
						})
					: undefined;
				const selected = new Set(
					matches.flatMap((entry) => [
						entry.nodeId,
						...entry.facts.flatMap((fact) =>
							fact.kind === "template" ? fact.nodeIds : [],
						),
					]),
				);
				const operationIds = new Set(
					matches.flatMap((entry) =>
						entry.facts.flatMap((fact) =>
							fact.kind === "template" ? [] : fact.operationIds,
						),
					),
				);
				const projected = readGraphDiscoveryFn(
					{
						projectId: captured.projectId,
						revision: captured.revision,
						status: readQueryStatusFn(
							analysis.audit.count > 0,
							!analysis.audit.complete,
						),
						truncated: hasMore || !analysis.audit.complete,
						reasons: [
							...analysis.reasons,
							...(hasMore
								? [
										"limit" as const,
									]
								: []),
						],
						expansions: analysis.expansions,
						nodes: captured.facts.nodes.filter((node) => selected.has(node.id)),
						edges: [],
						paths: [],
						operations: captured.facts.operations.filter((operation) =>
							operationIds.has(operation.id),
						),
					},
					captured.snapshotId,
					captured.discoveryIndex,
				);
				return readOperationReferencesFn(
					{
						...projected,
						audit: structuredClone({
							...analysis.audit,
							matches,
						}),
						...(nextCursor === undefined
							? {}
							: {
									nextCursor,
								}),
					},
					captured,
				);
			}
			if (query.kind === "flow") {
				const result = yield* queryGraphFlowFx(captured.operationIndex, query);
				const nodes = new Set([
					query.from,
					query.to,
				]);
				const operationIds = new Set<string>();
				for (const flow of result.flows)
					for (const step of flow.steps) {
						nodes.add(step.from);
						nodes.add(step.to);
						nodes.add(step.owner);
						for (const node of step.evidence.participants) nodes.add(node);
						operationIds.add(step.operationId);
					}
				const projected = readGraphDiscoveryFn(
					{
						projectId: captured.projectId,
						revision: captured.revision,
						status: result.status,
						truncated: result.truncated,
						reasons: result.reasons,
						expansions: result.expansions,
						nodes: captured.facts.nodes.filter((node) => nodes.has(node.id)),
						edges: [],
						paths: [],
						operations: captured.facts.operations.filter((operation) =>
							operationIds.has(operation.id),
						),
					},
					captured.snapshotId,
					captured.discoveryIndex,
				);
				return readOperationReferencesFn(
					{
						...projected,
						flows: result.flows,
					},
					captured,
				);
			}
			if (query.kind === "path" || query.kind === "traverse") {
				const { snapshotId: _snapshotId, ...editorInput } = query;
				const editorQuery = yield* parseInputFx(GraphQuerySchema, {
					...editorInput,
					detail: "full",
				});
				const result = yield* runQueryFx(captured, editorQuery);
				return readOperationReferencesFn(
					readGraphDiscoveryFn(result, captured.snapshotId, captured.discoveryIndex),
					captured,
				);
			}
			const requiredNodes =
				query.kind === "connections"
					? [
							query.from,
							query.to,
						]
					: [
							query.owner,
							query.participant,
						];
			for (const nodeId of requiredNodes) {
				if (nodeId !== undefined && !captured.operationIndex.nodes.has(nodeId))
					return yield* Effect.fail(
						new GraphQueryError({
							reason: "missing-node",
							message: `Unknown graph node ${nodeId}.`,
						}),
					);
			}
			const filters = filterKeyFn(query);
			const continuation = yield* readContinuationFx(captured, query.cursor, filters);
			const offset = continuation?.offset ?? 0;
			let candidates: readonly number[];
			if (query.kind === "connections") {
				candidates = [
					...new Set(
						(
							datascript.q(
								AdjacentQuery,
								captured.db,
								DirectionRules[query.direction],
								query.from,
							) as [
								number,
								string,
							][]
						)
							.filter(
								([index, next]) =>
									(query.to === undefined || next === query.to) &&
									(query.kinds === undefined ||
										query.kinds.includes(captured.facts.edges[index].kind)),
							)
							.map(([index]) => index),
					),
				].sort((a, b) => a - b);
			} else {
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
				const indexed =
					indexes.length === 0
						? captured.facts.operations.map((_, index) => index)
						: [
								...indexes[0],
							];
				const ordered =
					query.search === undefined
						? indexed.sort((a, b) => a - b)
						: captured.searchOperationsFn(query.search);
				candidates = ordered.filter(
					(index) =>
						indexes.every((values) => values.has(index)) &&
						readOperationFilterFn(captured.operationSummaries[index], query.filter),
				);
			}
			if (query.kind === "operations" && query.aggregate !== undefined) {
				const aggregated = yield* aggregateGraphOperationsFx(
					captured.operationSummaries,
					candidates,
					new Map(
						captured.facts.nodes.map((node) => [
							node.id,
							node.title,
						]),
					),
					{
						...query,
						aggregate: query.aggregate,
					},
					offset,
				);
				let nextCursor: string | undefined;
				if (aggregated.nextOffset !== undefined) {
					nextCursor = yield* issueContinuationFx({
						snapshotId: captured.snapshotId,
						revision: captured.revision,
						filters,
						offset: aggregated.nextOffset,
					});
				}
				return {
					projectId: captured.projectId,
					revision: captured.revision,
					snapshotId: captured.snapshotId,
					status: readQueryStatusFn(
						aggregated.aggregation.count > 0,
						!aggregated.aggregation.complete,
					),
					truncated: aggregated.reasons.length > 0,
					reasons: aggregated.reasons,
					expansions: aggregated.aggregation.count,
					nodes: [],
					edges: [],
					operations: [],
					paths: [],
					aggregation: aggregated.aggregation,
					...(nextCursor === undefined
						? {}
						: {
								nextCursor,
							}),
				};
			}
			const started = yield* Clock.currentTimeMillis;
			const reasons = new Set<GraphResult["reasons"][number]>();
			const selected: number[] = [];
			let expansions = 0;
			let position = offset;
			for (; position < candidates.length; position++) {
				if (selected.length >= query.limit) {
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
				selected.push(candidates[position]);
			}
			const operations =
				query.kind === "operations"
					? selected.map((index) => captured.facts.operations[index])
					: [];
			const selectedOperationIds = new Set(operations.map((operation) => operation.id));
			const result = readGraphDiscoveryFn(
				{
					projectId: captured.projectId,
					revision: captured.revision,
					status: readQueryStatusFn(selected.length > 0, reasons.size > 0),
					truncated: reasons.size > 0,
					reasons: [
						...reasons,
					].sort(),
					expansions,
					nodes:
						query.kind === "connections"
							? captured.facts.nodes.filter((node) => node.id === query.from)
							: [],
					edges:
						query.kind === "connections"
							? selected.map((index) => captured.facts.edges[index])
							: [],
					operations,
					paths: [],
				},
				captured.snapshotId,
				captured.discoveryIndex,
				query.kind !== "operations" ||
					(query.participant === undefined && query.role === undefined)
					? []
					: captured.operationIndex.participants.filter(
							(participant) =>
								selectedOperationIds.has(participant.operationId) &&
								(query.participant === undefined ||
									participant.nodeId === query.participant) &&
								(query.role === undefined || participant.role === query.role),
						),
			);
			let nextCursor: string | undefined;
			if (position < candidates.length) {
				nextCursor = yield* issueContinuationFx({
					snapshotId: captured.snapshotId,
					revision: captured.revision,
					filters,
					offset: position,
				});
			}
			return readOperationReferencesFn(
				{
					...result,
					...(nextCursor === undefined
						? {}
						: {
								nextCursor,
							}),
				},
				captured,
			);
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
					aggregation: found.aggregation,
					audit: found.audit,
					...(found.flows === undefined
						? {}
						: {
								flows: found.flows,
							}),
					...(found.matches === undefined
						? {}
						: {
								matches: found.matches,
							}),
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
				const index = captured.operationByReference.get(operationId);
				if (index === undefined)
					issues.push({
						operationId,
						reason: "missing-operation",
					});
				else
					operations.push({
						...captured.facts.operations[index],
						id: operationId,
					});
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
