import { match } from "ts-pattern";
import type { GraphFacts } from "~/graph/type/GraphFacts";
import type { GraphOperationIndex } from "~/graph/type/GraphOperationIndex";
import type { GraphAuditFact, GraphAuditIndex } from "~/graph/type/GraphAudit";

type OperationFactKind = Exclude<GraphAuditFact["kind"], "template">;

/** Presence-only facts share canonical operation roles and outputs with discovery and flow. */
export const compileGraphAuditFn = (
	facts: GraphFacts,
	operations: GraphOperationIndex,
): GraphAuditIndex => {
	const connected = new Set<string>();
	const nonReference = new Set<string>();
	const templates = new Map<string, Set<string>>();
	const evidence = new Map<string, Map<OperationFactKind, Set<string>>>();
	const addFn = (nodeId: string, kind: OperationFactKind, operationId: string) => {
		const categories = evidence.get(nodeId) ?? new Map<OperationFactKind, Set<string>>();
		const ids = categories.get(kind) ?? new Set<string>();
		ids.add(operationId);
		categories.set(kind, ids);
		evidence.set(nodeId, categories);
	};
	for (const edge of facts.edges) {
		connected.add(edge.from);
		connected.add(edge.to);
		if (edge.kind === "rule-reference") {
			if (edge.operationId !== undefined) {
				addFn(edge.from, "reference", edge.operationId);
				addFn(edge.to, "reference", edge.operationId);
			}
		} else {
			nonReference.add(edge.from);
			nonReference.add(edge.to);
		}
		if (edge.kind === "template-item") {
			const sources = templates.get(edge.to) ?? new Set<string>();
			sources.add(edge.from);
			templates.set(edge.to, sources);
		}
	}
	for (const participant of operations.participants) {
		if (participant.role === "input" || participant.role === "target")
			addFn(participant.nodeId, "usage", participant.operationId);
	}
	for (const { operation, outputs } of operations.operations) {
		for (const output of outputs) addFn(output.to, "producer", operation.id);
		if (operation.kind === "merge") addFn(operation.owner, "usage", operation.id);
		const behavior = match(operation)
			.with(
				{
					kind: "merge",
				},
				() => true,
			)
			.with(
				{
					kind: "line",
				},
				({ data }) =>
					outputs.length > 0 ||
					data.input.some(
						(input) => input.type !== "simple" || input.units !== undefined,
					),
			)
			.with(
				{
					kind: "clock",
				},
				{
					kind: "depletion",
				},
				() => outputs.length > 0,
			)
			.exhaustive();
		addFn(operation.owner, behavior ? "behavior" : "configuration-only", operation.id);
	}
	return {
		items: facts.nodes
			.filter((node) => node.kind === "item" && !node.missing)
			.map((node) => {
				const categories = evidence.get(node.id);
				const itemFacts: GraphAuditFact[] = (
					[
						"producer",
						"usage",
						"behavior",
						"configuration-only",
						"reference",
					] as const
				).map((kind) => {
					const ids = categories?.get(kind);
					return {
						kind,
						count: ids?.size ?? 0,
						operationIds: [
							...(ids ?? []),
						]
							.sort()
							.slice(0, 3),
					};
				});
				const sources = templates.get(node.id);
				itemFacts.push({
					kind: "template",
					count: sources?.size ?? 0,
					nodeIds: [
						...(sources ?? []),
					]
						.sort()
						.slice(0, 3),
				});
				return {
					nodeId: node.id,
					connected: connected.has(node.id),
					referenceOnly:
						(categories?.get("reference")?.size ?? 0) > 0 &&
						!nonReference.has(node.id) &&
						!categories?.has("behavior"),
					facts: itemFacts,
				};
			})
			.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
	};
};
