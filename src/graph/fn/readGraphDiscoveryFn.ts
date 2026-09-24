import { match } from "ts-pattern";
import type { GraphEdge, GraphFacts, GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphResult } from "~/graph/type/GraphResult";
import type {
	GraphDiscoveryEdge,
	GraphDiscoveryOperation,
	GraphDiscoveryResult,
} from "~/graph/type/GraphDiscoveryResult";

const readOperationFn = (
	operation: GraphOperation,
	ownerTitle: string,
): GraphDiscoveryOperation => {
	const outcomes = operation.kind === "clock" ? operation.data.onExpire : operation.data.outcome;
	const base = {
		id: operation.id,
		owner: operation.owner,
		hasOutcomes:
			outcomes?.set.some((set) => set.roll.some((roll) => roll.outcome.length > 0)) ?? false,
	};
	return match(operation)
		.returnType<GraphDiscoveryOperation>()
		.with(
			{
				kind: "line",
			},
			({ data }) => ({
				...base,
				kind: "line",
				title: data.title,
				lineUid: data.uid,
				runtimeMs: data.runtimeMs,
				default: data.default,
				clock: data.clock === true,
				clockWeight: data.clockWeight,
				show: data.show,
				enable: data.enable,
			}),
		)
		.with(
			{
				kind: "merge",
			},
			({ data }) => ({
				...base,
				kind: "merge",
				title: `${ownerTitle} · Merge`,
				action: data.action,
				effect: data.effect,
				ownership: data.action === "space" ? "receiver" : "source",
				...(data.action === "space"
					? {
							destination: `space:${data.space}`,
						}
					: {
							target: `item:${data.target.itemUid}`,
						}),
				...(data.effect === "replace"
					? {
							replacement: `item:${data.result}`,
						}
					: {}),
			}),
		)
		.with(
			{
				kind: "clock",
			},
			({ data }) => ({
				...base,
				kind: "clock",
				title: `${ownerTitle} · Clock`,
				enable: data.enable,
				...(data.intervalMs === undefined
					? {}
					: {
							intervalMs: data.intervalMs,
						}),
				...(data.durationMs === undefined
					? {}
					: {
							durationMs: data.durationMs,
						}),
				...(data.expiryMode === undefined
					? {}
					: {
							expiryMode: data.expiryMode,
						}),
			}),
		)
		.with(
			{
				kind: "depletion",
			},
			({ data }) => ({
				...base,
				kind: "depletion",
				title: `${ownerTitle} · Depletion`,
				amount: data.amount,
			}),
		)
		.exhaustive();
};

const readEdgeFn = (edge: GraphEdge): GraphDiscoveryEdge => {
	const annotations = edge.annotations;
	const input = annotations.input;
	const quantity = match({
		input,
		outcome: annotations.outcome,
	})
		.with(
			{
				input: {
					type: "materials",
				},
			},
			({ input }) => input.quantity,
		)
		.with(
			{
				outcome: {
					type: "item",
				},
			},
			({ outcome }) => outcome.quantity,
		)
		.otherwise(() => undefined);
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
			...(input?.type === "materials"
				? {
						mode: input.mode,
					}
				: {}),
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
			...(annotations.setId === undefined
				? {}
				: {
						setId: annotations.setId,
					}),
			...(annotations.setIndex === undefined
				? {}
				: {
						setIndex: annotations.setIndex,
					}),
			...(annotations.setWeight === undefined
				? {}
				: {
						setWeight: annotations.setWeight,
					}),
			...(annotations.alternative === undefined
				? {}
				: {
						alternative: annotations.alternative,
					}),
			...(annotations.rollId === undefined
				? {}
				: {
						rollId: annotations.rollId,
					}),
			...(annotations.rollIndex === undefined
				? {}
				: {
						rollIndex: annotations.rollIndex,
					}),
			...(annotations.rollType === undefined
				? {}
				: {
						rollType: annotations.rollType,
					}),
			...(annotations.chance === undefined
				? {}
				: {
						chance: annotations.chance,
					}),
			...(annotations.outcomeIndex === undefined
				? {}
				: {
						outcomeIndex: annotations.outcomeIndex,
					}),
			...(annotations.ruleIndex === undefined
				? {}
				: {
						ruleIndex: annotations.ruleIndex,
					}),
			...(annotations.whenIndex === undefined
				? {}
				: {
						whenIndex: annotations.whenIndex,
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
	const operations = facts.operations
		.filter((operation) => operationIds.has(operation.id))
		.map((operation) =>
			readOperationFn(operation, nodeById.get(operation.owner)?.title ?? operation.owner),
		);
	const nodeIds = new Set(result.nodes.map((node) => node.id));
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
	};
};
