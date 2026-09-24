import { match } from "ts-pattern";
import type { GraphEdge, GraphOperation, GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphOperationIndex } from "~/graph/type/GraphOperationIndex";
import type { GraphAuditIndex } from "~/graph/type/GraphAudit";

type Rules = readonly {
	readonly type: string;
}[];

// Positive enable rules can override the authored base flag. Their conditions remain runtime prerequisites.
const possibleFn = (enabled: boolean, rules: Rules): boolean =>
	enabled || rules.some((rule) => rule.type === "enable");

const availableOperationFn = (operation: GraphOperation): boolean =>
	match(operation)
		.with(
			{
				kind: "line",
			},
			({ data }) => possibleFn(data.enable, data.rules),
		)
		.with(
			{
				kind: "clock",
			},
			({ data }) => data.durationMs !== undefined && possibleFn(data.enable, data.rules),
		)
		.with(
			{
				kind: "merge",
			},
			{
				kind: "depletion",
			},
			() => true,
		)
		.exhaustive();

const availableOutputFn = (edge: GraphEdge, operation: GraphOperation): boolean => {
	if (edge.annotations.outcome === undefined) return edge.kind === "merge-replacement";
	const table = operation.kind === "clock" ? operation.data.onExpire : operation.data.outcome;
	const set = table?.set[edge.annotations.setIndex ?? -1];
	return (
		set !== undefined &&
		set.weight > 0 &&
		(edge.annotations.chance === undefined || edge.annotations.chance > 0) &&
		(edge.annotations.outcome.type !== "item" || edge.annotations.outcome.quantity.max > 0)
	);
};

/** Static audits inspect authored roles; producer eligibility belongs only to this audit policy. */
export const compileGraphAuditFn = (
	facts: GraphFacts,
	operations: GraphOperationIndex,
): GraphAuditIndex => {
	const items = facts.nodes.filter((node) => node.kind === "item" && !node.missing);
	const present = new Set(facts.nodes.filter((node) => !node.missing).map((node) => node.id));
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
	for (const { operation, sources, outputs } of operations.operations) {
		if (!availableOperationFn(operation) || sources.some(({ node }) => !present.has(node)))
			continue;
		for (const output of outputs) {
			if (!present.has(output.to) || !availableOutputFn(output, operation)) continue;
			const providedBy = producers.get(output.to) ?? new Set<string>();
			providedBy.add(operation.owner);
			producers.set(output.to, providedBy);
		}
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
