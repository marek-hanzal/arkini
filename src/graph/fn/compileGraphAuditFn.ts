import type { GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphOperationIndex } from "~/graph/type/GraphOperationIndex";
import type { GraphAuditIndex } from "~/graph/type/GraphAudit";

/** Static audits inspect authored roles; production uses the same eligible operation outputs as flow. */
export const compileGraphAuditFn = (
	facts: GraphFacts,
	operations: GraphOperationIndex,
): GraphAuditIndex => {
	const items = facts.nodes.filter((node) => node.kind === "item" && !node.missing);
	const connected = new Set<string>();
	const gameplay = new Set<string>();
	const reference = new Set<string>();
	const sources = new Set<string>();
	const owned = new Set(facts.operations.map((operation) => operation.owner));
	const producers = new Map<string, Set<string>>();
	const consumers = new Map<string, Set<string>>();
	const owners = new Map(
		facts.operations.map((operation) => [
			operation.id,
			operation.owner,
		]),
	);
	for (const edge of facts.edges) {
		connected.add(edge.from);
		connected.add(edge.to);
		if (edge.kind === "rule-reference") {
			reference.add(edge.from);
			reference.add(edge.to);
		} else {
			gameplay.add(edge.from);
			gameplay.add(edge.to);
		}
		if (edge.kind === "template-item") sources.add(edge.to);
	}
	for (const operation of facts.operations) gameplay.add(operation.owner);
	for (const participant of operations.participants) {
		if (participant.role === "reference" || participant.role === "output") continue;
		const owner = owners.get(participant.operationId)!;
		const usedBy = consumers.get(participant.nodeId) ?? new Set<string>();
		usedBy.add(owner);
		consumers.set(participant.nodeId, usedBy);
	}
	for (const { operation, outputs } of operations.operations)
		for (const output of outputs) {
			const providedBy = producers.get(output.to) ?? new Set<string>();
			providedBy.add(operation.owner);
			producers.set(output.to, providedBy);
		}
	return {
		items: items
			.map((node) => ({
				nodeId: node.id,
				connected: connected.has(node.id),
				ownsOperation: owned.has(node.id),
				source: sources.has(node.id),
				producers: [
					...(producers.get(node.id) ?? []),
				].sort(),
				consumers: [
					...(consumers.get(node.id) ?? []),
				].sort(),
				referenceOnly: reference.has(node.id) && !gameplay.has(node.id),
			}))
			.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
	};
};
