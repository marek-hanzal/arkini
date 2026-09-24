import { match } from "ts-pattern";
import type { GraphEdge, GraphFacts, GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphFlowIndex, GraphFlowStep } from "~/graph/type/GraphFlow";

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

/** Potential authored lineage: one transition binds its inputs and output to the same operation. */
export const compileGraphFlowFn = (facts: GraphFacts): GraphFlowIndex => {
	const nodes = new Set(facts.nodes.map((node) => node.id));
	const present = new Set(facts.nodes.filter((node) => !node.missing).map((node) => node.id));
	const byOperation = new Map<string, GraphEdge[]>();
	for (const edge of facts.edges) {
		if (edge.operationId === undefined) continue;
		const edges = byOperation.get(edge.operationId) ?? [];
		edges.push(edge);
		byOperation.set(edge.operationId, edges);
	}
	const outgoing = new Map<string, GraphFlowStep[]>();
	for (const operation of facts.operations) {
		if (!present.has(operation.owner) || !availableOperationFn(operation)) continue;
		const edges = byOperation.get(operation.id) ?? [];
		const participants = new Map<string, GraphFlowStep["evidence"]["fromRole"]>([
			[
				operation.owner,
				"owner",
			],
		]);
		const prerequisites: string[] = [];
		if (operation.kind === "line") {
			prerequisites.push(
				"All inputs of this production line must be satisfied; owner must be available.",
			);
			for (const [index, input] of operation.data.input.entries()) {
				if (input.type !== "simple") {
					const id = `item:${input.query.selector.itemUid}`;
					if (!participants.has(id)) participants.set(id, "input");
					if (input.type === "materials")
						prerequisites.push(
							`Input ${index + 1} (${JSON.stringify(id)}): ${input.mode} ${input.quantity.min}–${input.quantity.max}, distance=${input.query.distance}.`,
						);
					else
						prerequisites.push(
							`Input ${index + 1} (${JSON.stringify(id)}): unit provider, distance=${input.query.distance}.`,
						);
				}
				if (input.units !== undefined)
					prerequisites.push(
						`Input ${index + 1}: ${input.units.cost} units from ${input.units.from}.`,
					);
			}
			if (
				operation.data.rules.some(
					(rule) => rule.type === "enable" || rule.type === "disable",
				)
			)
				prerequisites.push("Line availability rules must pass.");
		} else if (operation.kind === "merge") {
			if (operation.data.action === "space")
				prerequisites.push(
					"Receiver-owned transport requires an incoming item of unspecified identity; transport admission and target effect must succeed.",
				);
			else {
				const target = `item:${operation.data.target.itemUid}`;
				if (!participants.has(target)) participants.set(target, "target");
				prerequisites.push(
					`Both source and target must be present; source action=${operation.data.action}, target effect=${operation.data.effect}.`,
				);
			}
		} else if (operation.kind === "clock") {
			prerequisites.push(
				"Owner's active lifetime must expire; Clock availability rules and expiry policy apply.",
			);
		} else prerequisites.push("Owner's finite units must be exhausted.");
		if (
			[
				...participants.keys(),
			].some((id) => !present.has(id))
		)
			continue;
		for (const edge of edges) {
			// Rule mentions inherit outcome annotations too; only actual output edge kinds qualify.
			const output = match(edge.kind)
				.with("merge-replacement", () => "replacement" as const)
				.with(
					"line-item-outcome",
					"merge-item-outcome",
					"clock-item-outcome",
					"depletion-item-outcome",
					"space-outcome",
					"template-outcome",
					() => "outcome" as const,
				)
				.otherwise(() => undefined);
			if (
				output === undefined ||
				!present.has(edge.to) ||
				!availableOutputFn(edge, operation)
			)
				continue;
			const outcome = edge.annotations.outcome;
			const table =
				operation.kind === "clock" ? operation.data.onExpire : operation.data.outcome;
			const set = table?.set[edge.annotations.setIndex ?? -1];
			const outputPrerequisites = [
				...prerequisites,
			];
			if ((set?.rules.length ?? 0) > 0 || (outcome?.rules.length ?? 0) > 0)
				outputPrerequisites.push("Outcome set and outcome availability rules must pass.");
			if (outcome !== undefined)
				outputPrerequisites.push(
					"Selected outcome must resolve and fit its placement constraints.",
				);
			for (const [from, fromRole] of participants) {
				const steps = outgoing.get(from) ?? [];
				steps.push({
					from,
					to: edge.to,
					operationId: operation.id,
					kind: operation.kind,
					owner: operation.owner,
					evidence: {
						fromRole,
						output,
						prerequisiteNodes: [
							...participants.keys(),
						].filter((id) => id !== from),
						prerequisites: [
							...outputPrerequisites,
						],
						...(edge.annotations.chance === undefined
							? {}
							: {
									chance: edge.annotations.chance,
								}),
						...(edge.annotations.alternative === undefined
							? {}
							: {
									alternative: edge.annotations.alternative,
								}),
						...(outcome?.type === "item"
							? {
									quantityMin: outcome.quantity.min,
									quantityMax: outcome.quantity.max,
								}
							: {}),
					},
				});
				outgoing.set(from, steps);
			}
		}
	}
	return {
		nodes,
		outgoing,
	};
};
