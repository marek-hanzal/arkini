import { match } from "ts-pattern";
import type { GraphEdge, GraphFacts } from "~/graph/type/GraphFacts";
import type {
	GraphOperationIndex,
	GraphIndexedOperation,
	GraphOperationParticipant,
	GraphOperationSource,
} from "~/graph/type/GraphOperationIndex";

/** Indexes authored roles, including operations with no edges; guards never become outputs. */
const participantsFn = (facts: GraphFacts): readonly GraphOperationParticipant[] => {
	const participants = new Map<string, GraphOperationParticipant>();
	const addFn = (
		operationId: string,
		nodeId: string,
		role: GraphOperationParticipant["role"],
		edgeId?: string,
	) => {
		participants.set(
			JSON.stringify([
				operationId,
				nodeId,
				role,
				edgeId,
			]),
			{
				operationId,
				nodeId,
				role,
				...(edgeId === undefined
					? {}
					: {
							edgeId,
						}),
			},
		);
	};
	for (const operation of facts.operations) {
		addFn(operation.id, operation.owner, "owner");
		if (operation.kind === "merge") {
			// Space transport is receiver-owned; its incoming source has no authored identity.
			addFn(
				operation.id,
				operation.data.action === "space"
					? operation.owner
					: `item:${operation.data.target.itemUid}`,
				"target",
			);
		}
	}
	for (const edge of facts.edges) {
		if (edge.operationId === undefined) continue;
		const participant = match(edge.kind)
			.with("line-material", "line-unit-selector", "line-unit-cost", () => ({
				nodeId: edge.from,
				role: "input" as const,
			}))
			.with(
				"merge-replacement",
				"merge-target-replacement",
				"line-item-outcome",
				"merge-item-outcome",
				"clock-item-outcome",
				"depletion-item-outcome",
				"space-outcome",
				"template-outcome",
				"merge-space",
				() => ({
					nodeId: edge.to,
					role: "output" as const,
				}),
			)
			.with("rule-reference", () => ({
				nodeId: edge.to,
				role: "reference" as const,
			}))
			.with(
				"merge-target",
				"merge-source-spend",
				"merge-target-spend",
				"template-item",
				"start-template",
				"start-space",
				() => undefined,
			)
			.exhaustive();
		if (participant !== undefined)
			addFn(edge.operationId, participant.nodeId, participant.role, edge.id);
	}
	return [
		...participants.values(),
	];
};

/** Pure authored adjacency: every source and output belong to the same operation. */
export const compileGraphOperationIndexFn = (facts: GraphFacts): GraphOperationIndex => {
	const nodes = new Map(
		facts.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const participants = participantsFn(facts);
	const sourcesByOperation = new Map<string, Map<string, GraphOperationSource>>();
	for (const participant of participants) {
		if (participant.role === "output" || participant.role === "reference") continue;
		const sources =
			sourcesByOperation.get(participant.operationId) ??
			new Map<string, GraphOperationSource>();
		if (!sources.has(participant.nodeId))
			sources.set(participant.nodeId, {
				node: participant.nodeId,
				role: participant.role,
			});
		sourcesByOperation.set(participant.operationId, sources);
	}
	const outputsByOperation = new Map<string, GraphEdge[]>();
	for (const edge of facts.edges) {
		if (edge.operationId === undefined) continue;
		// Replacement aliases, references and receiver-to-space transport are structural relations.
		const output = match(edge.kind)
			.with(
				"merge-replacement",
				"line-item-outcome",
				"merge-item-outcome",
				"clock-item-outcome",
				"depletion-item-outcome",
				"space-outcome",
				"template-outcome",
				() => true,
			)
			.otherwise(() => false);
		if (!output) continue;
		const outputs = outputsByOperation.get(edge.operationId) ?? [];
		outputs.push(edge);
		outputsByOperation.set(edge.operationId, outputs);
	}
	const operations: GraphIndexedOperation[] = [];
	const outgoing = new Map<string, GraphIndexedOperation[]>();
	for (const operation of facts.operations) {
		const sources = [
			...(sourcesByOperation.get(operation.id)?.values() ?? []),
		];
		const indexed: GraphIndexedOperation = {
			operation,
			sources,
			outputs: outputsByOperation.get(operation.id) ?? [],
		};
		operations.push(indexed);
		if (indexed.outputs.length === 0) continue;
		for (const { node } of sources) {
			const entries = outgoing.get(node) ?? [];
			entries.push(indexed);
			outgoing.set(node, entries);
		}
	}
	return {
		nodes,
		participants,
		operations,
		outgoing,
	};
};
