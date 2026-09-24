import { match } from "ts-pattern";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import type { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import type {
	GraphBatchResult,
	GraphDiscoveryEdge,
	GraphDiscoveryNode,
	GraphDiscoveryOperation,
	GraphDiscoveryResult,
} from "~/graph/type/GraphDiscoveryResult";

type Query = Pick<GraphDiscoveryQuerySchema.Type, "kind" | "from">;
type NodeLabelFn = (id: string) => string;

// Quoting every exact identity preserves even quotes, brackets, control characters and newlines.
const identityFn = (id: string): string => JSON.stringify(id);
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
				`line=${identityFn(line.title)}`,
				`lineUid=${identityFn(line.lineUid)}`,
				`runtimeMs=${line.runtimeMs}`,
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
				...(clock.intervalMs === undefined
					? []
					: [
							`intervalMs=${clock.intervalMs}`,
						]),
				...(clock.durationMs === undefined
					? []
					: [
							`durationMs=${clock.durationMs}`,
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
	metadata.push(`edgeId=${identityFn(edge.id)}`);
	return metadata.join("; ");
};

const bodyFn = (result: GraphDiscoveryResult, query: Query): string => {
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
		.with("operations", () =>
			result.operations.map((operation) => operationRowFn(operation, labelFn)).join("\n"),
		)
		.with("node", () =>
			[
				...(query.from === undefined
					? []
					: [
							labelFn(query.from),
						]),
				...result.operations.map((operation) => operationRowFn(operation, labelFn)),
			].join("\n"),
		)
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
							return `  ${hop + 1}. ${edge === undefined ? `edgeId=${identityFn(id)}` : edgeRowFn(edge, path.nodes[hop], path.nodes[hop + 1])}`;
						}),
					].join("\n"),
				)
				.join("\n\n");
		})
		.with("connections", "traverse", () =>
			result.edges.length === 0
				? query.from === undefined
					? ""
					: labelFn(query.from)
				: result.edges.map((edge) => `- ${edgeRowFn(edge)}`).join("\n"),
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
	const sections = result.queries.map((query) => {
		const parsed = GraphDiscoveryQuerySchema.safeParse(requested.get(query.id));
		const nodeIds = new Set(query.nodeIds);
		const edgeIds = new Set(query.edgeIds);
		const operationIds = new Set(query.operationIds);
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
							nodes: result.nodes.filter((node) => nodeIds.has(node.id)),
							edges: result.edges.filter((edge) => edgeIds.has(edge.id)),
							operations: result.operations.filter((operation) =>
								operationIds.has(operation.id),
							),
							paths: query.paths,
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
