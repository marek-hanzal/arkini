import { match, P } from "ts-pattern";
import type { GraphEdge, GraphFacts } from "~/graph/type/GraphFacts";
import { readGraphOperationSummaryFn } from "~/graph/fn/readGraphOperationSummaryFn";
import type { GraphOperationParticipant } from "~/graph/type/GraphOperationIndex";
import type { GraphResult } from "~/graph/type/GraphResult";
import type {
	GraphDiscoveryEdge,
	GraphDiscoveryMatch,
	GraphDiscoveryResult,
} from "~/graph/type/GraphDiscoveryResult";

const readEdgeFn = (edge: GraphEdge): GraphDiscoveryEdge => {
	const annotations = edge.annotations;
	const input = annotations.input;
	const quantity = match({
		kind: edge.kind,
		input,
		outcome: annotations.outcome,
	})
		.with(
			{
				kind: "line-material",
				input: {
					type: "materials",
				},
			},
			({ input }) => input.quantity,
		)
		.with(
			{
				kind: P.union(
					"line-item-outcome",
					"merge-item-outcome",
					"clock-item-outcome",
					"depletion-item-outcome",
				),
				outcome: {
					type: "item",
				},
			},
			({ outcome }) => outcome.quantity,
		)
		.otherwise(() => undefined);
	// A self payer is not the selected material/provider; enclosing outcome guards are not outputs.
	const distance = match({
		kind: edge.kind,
		input,
	})
		.with(
			{
				kind: P.union("line-material", "line-unit-selector"),
				input: {
					type: P.union("materials", "units"),
				},
			},
			({ input }) => input.query.distance,
		)
		.with(
			{
				kind: "line-unit-cost",
				input: {
					type: P.union("materials", "units"),
					units: {
						from: "target",
					},
				},
			},
			({ input }) => input.query.distance,
		)
		.otherwise(() => annotations.condition?.query.distance);
	return {
		id: edge.id,
		from: edge.from,
		to: edge.to,
		kind: edge.kind,
		...(edge.operationId === undefined
			? {}
			: {
					operationId: edge.operationId,
				}),
		metadata: {
			...(input === undefined
				? {}
				: {
						inputType: input.type,
					}),
			...(edge.kind === "line-material" && input?.type === "materials"
				? {
						mode: input.mode,
					}
				: {}),
			...(distance === undefined
				? {}
				: {
						distance,
					}),
			...(quantity === undefined
				? {}
				: {
						quantityMin: quantity.min,
						quantityMax: quantity.max,
					}),
			...(input?.units === undefined
				? {}
				: {
						unitCost: input.units.cost,
						unitFrom: input.units.from,
					}),
			...(annotations.alternative === undefined
				? {}
				: {
						alternative: annotations.alternative,
					}),
			...(annotations.chance === undefined
				? {}
				: {
						chance: annotations.chance,
					}),
			...(annotations.inputIndex === undefined
				? {}
				: {
						inputIndex: annotations.inputIndex,
					}),
			...(annotations.role === undefined
				? {}
				: {
						role: annotations.role,
					}),
			...(annotations.boardLocal === undefined
				? {}
				: {
						boardLocal: annotations.boardLocal,
					}),
			...(annotations.position === undefined
				? {}
				: {
						x: annotations.position.x,
						y: annotations.position.y,
					}),
		},
	};
};

/** Projects selected graph facts without leaking authored documents or expanding operation outcomes. */
export const readGraphDiscoveryFn = (
	result: GraphResult,
	snapshotId: string,
	facts: GraphFacts,
	participants: readonly GraphOperationParticipant[] = [],
): GraphDiscoveryResult => {
	const nodeById = new Map(
		facts.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const operationIds = new Set(result.operations.map((operation) => operation.id));
	for (const edge of result.edges)
		if (edge.operationId !== undefined) operationIds.add(edge.operationId);
	const operationById = new Map(
		facts.operations.map((operation) => [
			operation.id,
			operation,
		]),
	);
	const operations = [
		...operationIds,
	].flatMap((id) => {
		const operation = operationById.get(id);
		return operation === undefined
			? []
			: [
					readGraphOperationSummaryFn(
						operation,
						nodeById.get(operation.owner)?.title ?? operation.owner,
					),
				];
	});
	const edgeById = new Map(
		participants.length === 0
			? []
			: facts.edges.map((edge) => [
					edge.id,
					edge,
				]),
	);
	const matches: GraphDiscoveryMatch[] = participants
		.filter((participant) => operationIds.has(participant.operationId))
		.map(({ operationId, nodeId, role, edgeId }) => {
			const edge = edgeId === undefined ? undefined : edgeById.get(edgeId);
			return {
				operationId,
				nodeId,
				role,
				...(edge === undefined
					? {}
					: {
							edgeKind: edge.kind,
							metadata: readEdgeFn(edge).metadata,
						}),
			};
		});
	const nodeIds = new Set(result.nodes.map((node) => node.id));
	for (const participant of matches) nodeIds.add(participant.nodeId);
	for (const edge of result.edges) {
		nodeIds.add(edge.from);
		nodeIds.add(edge.to);
	}
	for (const operation of operations) {
		nodeIds.add(operation.owner);
		if (operation.kind === "merge") {
			if (operation.target !== undefined) nodeIds.add(operation.target);
			if (operation.replacement !== undefined) nodeIds.add(operation.replacement);
			if (operation.destination !== undefined) nodeIds.add(operation.destination);
		}
	}
	return {
		projectId: result.projectId,
		revision: result.revision,
		snapshotId,
		status: result.status,
		truncated: result.truncated,
		reasons: result.reasons,
		expansions: result.expansions,
		paths: result.paths,
		nodes: facts.nodes
			.filter((node) => nodeIds.has(node.id))
			.map((node) => ({
				id: node.id,
				kind: node.kind,
				title: node.title,
				...(node.missing
					? {
							missing: true,
						}
					: {}),
			})),
		edges: result.edges.map(readEdgeFn),
		operations,
		...(matches.length === 0
			? {}
			: {
					matches,
				}),
	};
};
