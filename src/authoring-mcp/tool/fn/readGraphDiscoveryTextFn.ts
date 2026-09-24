import { match } from "ts-pattern";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import type { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import type {
	GraphBatchResult,
	GraphDiscoveryEdge,
	GraphDiscoveryMatch,
	GraphDiscoveryNode,
	GraphDiscoveryOperation,
	GraphDiscoveryResult,
} from "~/graph/type/GraphDiscoveryResult";

type Query = {
	readonly kind: GraphDiscoveryQuerySchema.Type["kind"];
	readonly from?: string;
};
type NodeLabelFn = (id: string) => string;

// Ordinary identities copy directly; unusual delimiters or controls use a lossless JSON string literal.
const identityFn = (id: string): string =>
	/^[\p{L}\p{N}_.:@/-]+$/u.test(id) ? id : JSON.stringify(id);
const titleFn = (title: string): string => JSON.stringify(title).slice(1, -1);
const nodeLabelFn = (nodes: ReadonlyMap<string, GraphDiscoveryNode>, id: string): string => {
	const node = nodes.get(id);
	return `${titleFn(node?.title ?? id)} [${identityFn(id)}]${node?.missing ? " (missing)" : ""}`;
};
const headerFn = (
	result: Pick<GraphDiscoveryResult, "projectId" | "revision" | "snapshotId">,
): string =>
	`Project: ${identityFn(result.projectId)}\nRevision: ${result.revision}\nSnapshot: ${identityFn(result.snapshotId)}`;
const statusFn = (
	result: Pick<
		GraphDiscoveryResult,
		"status" | "truncated" | "reasons" | "expansions" | "nextCursor"
	>,
): string =>
	[
		`Status: ${result.status}; truncated: ${result.truncated}; expansions: ${result.expansions}`,
		...(result.reasons.length === 0
			? []
			: [
					`Reasons: ${result.reasons.join(", ")}`,
				]),
		...(result.nextCursor === undefined
			? []
			: [
					`Cursor: ${identityFn(result.nextCursor)}`,
				]),
	].join("\n");

const operationDetailsFn = (operation: GraphDiscoveryOperation): readonly string[] => [
	...match(operation)
		.with(
			{
				kind: "line",
			},
			(line) => [
				`line=${titleFn(line.title)}`,
				`lineUid=${identityFn(line.lineUid)}`,
				`runtimeSeconds=${line.runtimeSeconds}`,
				`default=${line.default}`,
				`clock=${line.clock}`,
				...(line.clock
					? [
							`clockWeight=${line.clockWeight}`,
						]
					: []),
				`show=${line.show}`,
				`enable=${line.enable}`,
				`outcomes=${line.hasOutcomes}`,
			],
		)
		.with(
			{
				kind: "merge",
			},
			(merge) => [
				`action=${merge.action}`,
				`effect=${merge.effect}`,
				`ownership=${merge.ownership}`,
				`additional outcomes=${merge.hasOutcomes}`,
			],
		)
		.with(
			{
				kind: "clock",
			},
			(clock) => [
				...(clock.intervalSeconds === undefined
					? []
					: [
							`intervalSeconds=${clock.intervalSeconds}`,
						]),
				...(clock.durationSeconds === undefined
					? []
					: [
							`durationSeconds=${clock.durationSeconds}`,
						]),
				...(clock.expiryMode === undefined
					? []
					: [
							`expiryMode=${clock.expiryMode}`,
						]),
				`enable=${clock.enable}`,
				`expiry outcomes=${clock.hasOutcomes}`,
			],
		)
		.with(
			{
				kind: "depletion",
			},
			(depletion) => [
				`units=${depletion.amount}`,
				`depletion outcomes=${depletion.hasOutcomes}`,
			],
		)
		.exhaustive(),
	`operationId=${identityFn(operation.id)}`,
];

const operationRowFn = (operation: GraphDiscoveryOperation, labelFn: NodeLabelFn): string => {
	const subject = match(operation)
		.with(
			{
				kind: "merge",
				ownership: "receiver",
			},
			(merge) =>
				`${labelFn(merge.owner)} receives an incoming item → ${merge.destination === undefined ? "unknown destination" : labelFn(merge.destination)}${merge.replacement === undefined ? "" : `; receiver replacement → ${labelFn(merge.replacement)}`}`,
		)
		.with(
			{
				kind: "merge",
			},
			(merge) =>
				`${labelFn(merge.owner)} + ${merge.target === undefined ? "unknown target" : labelFn(merge.target)}${merge.replacement === undefined ? "" : ` → ${labelFn(merge.replacement)}`}`,
		)
		.otherwise((operation) => labelFn(operation.owner));
	return `- ${operation.kind}: ${subject}; ${operationDetailsFn(operation).join("; ")}`;
};

const edgeDetailsFn = (
	edge: GraphDiscoveryEdge,
	operation: GraphDiscoveryOperation | undefined,
	labelFn: NodeLabelFn,
): string => {
	const metadata = Object.entries(edge.metadata).map(
		([key, value]) => `${key}=${typeof value === "string" ? titleFn(value) : value}`,
	);
	if (operation !== undefined) {
		if (operation.owner !== edge.from && operation.owner !== edge.to)
			metadata.push(`owner=${labelFn(operation.owner)}`);
		if (operation.kind === "merge") {
			for (const [role, id] of [
				[
					"target",
					operation.target,
				],
				[
					"replacement",
					operation.replacement,
				],
				[
					"destination",
					operation.destination,
				],
			] as const)
				if (id !== undefined && id !== edge.from && id !== edge.to)
					metadata.push(`${role}=${labelFn(id)}`);
		}
		metadata.push(...operationDetailsFn(operation));
	} else if (edge.operationId !== undefined)
		metadata.push(`operationId=${identityFn(edge.operationId)}`);
	return metadata.join("; ");
};

const quantityFn = (min: number | undefined, max: number | undefined): string => {
	if (min === undefined) return "";
	if (max === undefined || min === max) return ` ×${min}`;
	return ` ×${min}–${max}`;
};

const matchRowFn = (evidence: GraphDiscoveryMatch, labelFn: NodeLabelFn): string => {
	const { quantityMin, quantityMax, ...metadata } = evidence.metadata ?? {};
	const quantity = quantityFn(quantityMin, quantityMax);
	const details = [
		...(evidence.edgeKind === undefined
			? []
			: [
					evidence.edgeKind,
				]),
		...Object.entries(metadata).map(
			([key, value]) => `${key}=${typeof value === "string" ? titleFn(value) : value}`,
		),
	];
	const role = evidence.role === "reference" ? "references" : evidence.role;
	return `  ${role}: ${labelFn(evidence.nodeId)}${quantity}${details.length === 0 ? "" : `; ${details.join("; ")}`}`;
};

const aggregationTextFn = (
	aggregation: NonNullable<GraphDiscoveryResult["aggregation"]>,
): string => {
	const count = aggregation.complete
		? `${aggregation.count}`
		: `≥${aggregation.count} (incomplete; total unknown)`;
	if (aggregation.mode === "count") return `Count: ${count}`;
	return [
		`Count: ${count}; grouped by ${aggregation.by}`,
		...aggregation.groups.map((group) => {
			const label =
				aggregation.by === "owner" && group.key !== null
					? `${titleFn(group.label)} [${identityFn(group.key)}]`
					: titleFn(group.label);
			return `- ${label}: ${aggregation.complete ? "" : "≥"}${group.count}`;
		}),
	].join("\n");
};

const bodyFn = (result: GraphDiscoveryResult, query: Query): string => {
	if (result.aggregation !== undefined) return aggregationTextFn(result.aggregation);
	const nodes = new Map(
		result.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const operations = new Map(
		result.operations.map((operation) => [
			operation.id,
			operation,
		]),
	);
	const labelFn = (id: string) => nodeLabelFn(nodes, id);
	const shownOperations = new Set<string>();
	const edgeRowFn = (edge: GraphDiscoveryEdge, start = edge.from, end = edge.to): string => {
		const arrow =
			edge.from === start && edge.to === end ? `--${edge.kind}-->` : `<--${edge.kind}--`;
		const operation =
			edge.operationId === undefined || shownOperations.has(edge.operationId)
				? undefined
				: operations.get(edge.operationId);
		if (edge.operationId !== undefined) shownOperations.add(edge.operationId);
		return `${labelFn(start)} ${arrow} ${labelFn(end)}; ${edgeDetailsFn(edge, operation, labelFn)}`;
	};
	return match(query.kind)
		.with("audit", () => {
			const audit = result.audit;
			if (audit === undefined) return "";
			const prefix = audit.complete ? "" : "≥";
			return [
				`Audit matches: ${prefix}${audit.count}${audit.complete ? "" : " (incomplete; total unknown)"}`,
				...audit.matches.flatMap((entry) => [
					`- ${labelFn(entry.nodeId)} — ${titleFn(entry.reason)}`,
					...entry.facts.flatMap((fact) => {
						if (fact.kind === "template")
							return [
								`  Templates: ${fact.count}${fact.count > fact.nodeIds.length ? ` (showing ${fact.nodeIds.length})` : ""}${fact.nodeIds.length === 0 ? "" : `; ${fact.nodeIds.map(labelFn).join(", ")}`}`,
							];
						return [
							`  ${fact.kind} operations: ${fact.count}${fact.count > fact.operationIds.length ? ` (showing ${fact.operationIds.length}; query graph_operations for more)` : ""}`,
							...fact.operationIds.map((id) => {
								const operation = operations.get(id);
								return `    ${operation === undefined ? `operationId=${identityFn(id)}` : operationRowFn(operation, labelFn)}`;
							}),
						];
					}),
				]),
			].join("\n");
		})
		.with("operations", () =>
			result.operations
				.flatMap((operation) => [
					operationRowFn(operation, labelFn),
					...(result.matches ?? [])
						.filter((evidence) => evidence.operationId === operation.id)
						.map((evidence) => matchRowFn(evidence, labelFn)),
				])
				.join("\n"),
		)
		.with("search", () =>
			result.nodes
				.map((node) =>
					[
						`- ${labelFn(node.id)}; kind=${node.kind}`,
						...(node.clock?.intervalSeconds === undefined
							? []
							: [
									`clock intervalSeconds=${node.clock.intervalSeconds}`,
								]),
						...(node.clock?.durationSeconds === undefined
							? []
							: [
									`clock durationSeconds=${node.clock.durationSeconds}`,
								]),
					].join("; "),
				)
				.join("\n"),
		)
		.with("flow", () => {
			if ((result.flows?.length ?? 0) === 0)
				return result.truncated
					? "No flow found within the search bounds; existence remains unknown."
					: "No authored transformation flow exists in the selected operation scope.";
			return [
				"Authored operation paths; gameplay rules and stochastic choices are reported, not evaluated.",
				...(result.flows ?? []).map((flow, index) =>
					[
						`Flow ${index + 1}${flow.steps.length === 0 ? `: ${flow.nodes.map(labelFn).join(" → ")} (same node; no transformation)` : ":"}`,
						...flow.steps.flatMap((step, stepIndex) => [
							`  ${stepIndex + 1}. ${labelFn(step.from)} → ${labelFn(step.to)}; via ${step.kind}; role=${step.evidence.fromRole}; output=${step.evidence.output}; operationId=${identityFn(step.operationId)}`,
							`     owner: ${labelFn(step.owner)}`,
							`     participants: ${step.evidence.participants.map(labelFn).join(", ")}`,
							...step.evidence.facts.map((fact) => `     ${fact}`),
						]),
					].join("\n"),
				),
			].join("\n\n");
		})
		.with("path", () => {
			const edges = new Map(
				result.edges.map((edge) => [
					edge.id,
					edge,
				]),
			);
			return result.paths
				.map((path, index) =>
					[
						`Path ${index + 1}${path.edges.length === 0 ? `: ${path.nodes.map(labelFn).join(" → ")} (zero hops)` : ":"}`,
						...path.edges.map((id, hop) => {
							const edge = edges.get(id);
							return `  ${hop + 1}. ${edge === undefined ? `${labelFn(path.nodes[hop])} → ${labelFn(path.nodes[hop + 1])}; relationship unavailable` : edgeRowFn(edge, path.nodes[hop], path.nodes[hop + 1])}`;
						}),
					].join("\n"),
				)
				.join("\n\n");
		})
		.with("connections", () => {
			const grouped = new Map<string, GraphDiscoveryEdge[]>();
			for (const edge of result.edges) {
				const key = edge.operationId ?? edge.id;
				const group = grouped.get(key) ?? [];
				group.push(edge);
				grouped.set(key, group);
			}
			return (
				[
					...grouped.values(),
				]
					.flatMap((edges) => {
						const operation = operations.get(edges[0].operationId ?? "");
						if (edges.length === 1 || operation === undefined)
							return edges.map((edge) => `- ${edgeRowFn(edge)}`);
						return [
							operationRowFn(operation, labelFn),
							...edges.map(
								(edge) =>
									`  ${labelFn(edge.from)} --${edge.kind}--> ${labelFn(edge.to)}; ${edgeDetailsFn(
										{
											...edge,
											operationId: undefined,
										},
										undefined,
										labelFn,
									)}`,
							),
						];
					})
					.join("\n") || (query.from === undefined ? "" : labelFn(query.from))
			);
		})
		.with(
			"traverse",
			() =>
				result.edges.map((edge) => `- ${edgeRowFn(edge)}`).join("\n") ||
				(query.from === undefined ? "" : labelFn(query.from)),
		)
		.exhaustive();
};

/** Query-shaped navigation text; canonical operation documents remain in graph_operations_json. */
export const readGraphDiscoveryTextFn = (result: GraphDiscoveryResult, query: Query): string =>
	[
		headerFn(result),
		statusFn(result),
		bodyFn(result, query),
	]
		.filter((part) => part.length > 0)
		.join("\n");

/** Dereferences each batch result without exposing or repeating its internal storage tables. */
export const readGraphBatchTextFn = (
	result: GraphBatchResult,
	requests: GraphBatchQuerySchema.Type["queries"],
): string => {
	const requested = new Map(
		requests.map((request) => [
			request.id,
			request.query,
		]),
	);
	const nodesById = new Map(
		result.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const operationsById = new Map(
		result.operations.map((operation) => [
			operation.id,
			operation,
		]),
	);
	const edgesById = new Map(
		result.edges.map((edge) => [
			edge.id,
			edge,
		]),
	);
	const sections = result.queries.map((query) => {
		const parsed = GraphDiscoveryQuerySchema.safeParse(requested.get(query.id));
		const body =
			parsed.success && query.error === undefined
				? bodyFn(
						{
							projectId: result.projectId,
							revision: result.revision,
							snapshotId: result.snapshotId,
							status: query.status,
							truncated: query.truncated,
							reasons: query.reasons,
							expansions: query.expansions,
							nodes: query.nodeIds.flatMap((id) => {
								const node = nodesById.get(id);
								return node === undefined
									? []
									: [
											node,
										];
							}),
							edges: query.edgeIds.flatMap((id) => {
								const edge = edgesById.get(id);
								return edge === undefined
									? []
									: [
											edge,
										];
							}),
							operations: query.operationIds.flatMap((id) => {
								const operation = operationsById.get(id);
								return operation === undefined
									? []
									: [
											operation,
										];
							}),
							matches: query.matches,
							paths: query.paths,
							flows: query.flows,
							aggregation: query.aggregation,
							audit: query.audit,
						},
						parsed.data,
					)
				: "";
		return [
			`Query: ${identityFn(query.id)}`,
			statusFn(query),
			...(query.error === undefined
				? []
				: [
						`Error: ${query.error.reason}; ${titleFn(query.error.message)}`,
					]),
			body,
		]
			.filter((part) => part.length > 0)
			.join("\n");
	});
	return [
		headerFn(result),
		...sections,
	].join("\n\n");
};
