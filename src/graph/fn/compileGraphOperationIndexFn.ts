import { match } from "ts-pattern";
import type { GraphEdge, GraphFacts, GraphOperation } from "~/graph/type/GraphFacts";
import type {
	GraphOperationIndex,
	GraphIndexedOperation,
	GraphOperationParticipant,
	GraphOperationRequirement,
	GraphOperationOutput,
	GraphOperationParticipantEffect,
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

const participantEffectsFn = (
	operation: GraphOperation,
): readonly GraphOperationParticipantEffect[] => {
	const effects = match(operation)
		.with(
			{
				kind: "line",
			},
			({ owner, data }) => [
				{
					node: owner,
					effect: "preserved" as const,
				},
				...data.input.flatMap((input): GraphOperationParticipantEffect[] => {
					const target =
						input.type === "simple" ? owner : `item:${input.query.selector.itemUid}`;
					const effects: GraphOperationParticipantEffect[] = [];
					if (input.type !== "simple")
						effects.push({
							node: target,
							effect:
								input.type === "materials" && input.mode === "consume"
									? "consumed"
									: "preserved",
						});
					if (input.units !== undefined)
						effects.push({
							node: input.units.from === "self" ? owner : target,
							effect: "spent",
						});
					return effects;
				}),
			],
		)
		.with(
			{
				kind: "merge",
			},
			({ owner, data }) => {
				const target = data.action === "space" ? owner : `item:${data.target.itemUid}`;
				const effects: GraphOperationParticipantEffect[] = [];
				if (data.action !== "space")
					effects.push({
						node: owner,
						effect: match(data.action)
							.with("consume", () => "consumed" as const)
							.with("spend", () => "spent" as const)
							.with("use", () => "preserved" as const)
							.exhaustive(),
					});
				effects.push({
					node: target,
					effect: match(data.effect)
						.with("keep", () => "preserved" as const)
						.with("remove", () => "removed" as const)
						.with("replace", () => "replaced" as const)
						.with("spend", () => "spent" as const)
						.exhaustive(),
				});
				return effects;
			},
		)
		.with(
			{
				kind: "clock",
			},
			{
				kind: "depletion",
			},
			({ owner }) => [
				{
					node: owner,
					effect: "removed" as const,
				},
			],
		)
		.exhaustive();
	const priority = {
		preserved: 0,
		spent: 1,
		consumed: 2,
		removed: 3,
		replaced: 4,
	};
	const byNode = new Map<string, GraphOperationParticipantEffect>();
	// Multiple inputs can mention one canonical participant; preservation cannot undo its retirement.
	for (const effect of effects) {
		const previous = byNode.get(effect.node);
		if (previous === undefined || priority[effect.effect] > priority[previous.effect])
			byNode.set(effect.node, effect);
	}
	return [
		...byNode.values(),
	];
};

/** Never combine products from mutually exclusive sets or unselected chance rolls. */
const createdNodesFn = (
	selected: GraphEdge,
	edges: readonly GraphEdge[],
	operation: GraphOperation,
): readonly string[] => {
	const created = new Set([
		selected.to,
	]);
	const table = operation.kind === "clock" ? operation.data.onExpire : operation.data.outcome;
	// Replacement itself does not select an outcome set. Only an unconditional sole set
	// has guaranteed co-products without inventing a choice across alternative sets.
	const soleReplacementSet =
		selected.kind === "merge-replacement" &&
		table?.set.length === 1 &&
		table.set[0].rules.length === 0;
	for (const edge of edges) {
		if (edge.kind === "merge-replacement") created.add(edge.to);
		const outcome = edge.annotations.outcome;
		if (outcome?.type !== "item" || outcome.quantity.min <= 0 || outcome.rules.length > 0)
			continue;
		if (!availableOutputFn(edge, operation) || edge.kind === "rule-reference") continue;
		if (
			!soleReplacementSet &&
			(selected.annotations.setId === undefined ||
				edge.annotations.setId !== selected.annotations.setId)
		)
			continue;
		if (
			edge.annotations.rollId === selected.annotations.rollId ||
			edge.annotations.rollType === "guaranteed" ||
			edge.annotations.chance === 1
		)
			created.add(edge.to);
	}
	return [
		...created,
	].sort();
};

/** Potential authored lineage: one transition binds its inputs and output to the same operation. */
export const compileGraphOperationIndexFn = (facts: GraphFacts): GraphOperationIndex => {
	const nodes = new Set(facts.nodes.map((node) => node.id));
	const present = new Set(facts.nodes.filter((node) => !node.missing).map((node) => node.id));
	const byOperation = new Map<string, GraphEdge[]>();
	for (const edge of facts.edges) {
		if (edge.operationId === undefined) continue;
		const edges = byOperation.get(edge.operationId) ?? [];
		edges.push(edge);
		byOperation.set(edge.operationId, edges);
	}
	const authoredParticipants = participantsFn(facts);
	const participantsByOperation = new Map<string, GraphOperationParticipant[]>();
	for (const participant of authoredParticipants) {
		const members = participantsByOperation.get(participant.operationId) ?? [];
		members.push(participant);
		participantsByOperation.set(participant.operationId, members);
	}
	const operations: GraphIndexedOperation[] = [];
	const outgoing = new Map<string, GraphIndexedOperation[]>();
	for (const operation of facts.operations) {
		const edges = byOperation.get(operation.id) ?? [];
		const participants = new Map<string, GraphOperationRequirement["role"]>();
		for (const participant of participantsByOperation.get(operation.id) ?? []) {
			if (participant.role === "output" || participant.role === "reference") continue;
			if (!participants.has(participant.nodeId))
				participants.set(participant.nodeId, participant.role);
		}
		const prerequisites: string[] = [];
		const participantEffects = participantEffectsFn(operation);
		if (operation.kind === "line") {
			prerequisites.push(
				"All inputs of this production line must be satisfied; owner must be available.",
			);
			for (const [index, input] of operation.data.input.entries()) {
				if (input.type !== "simple") {
					const id = `item:${input.query.selector.itemUid}`;
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
				prerequisites.push(
					`Both source and target must be present; source action=${operation.data.action}, target effect=${operation.data.effect}.`,
				);
			}
		} else if (operation.kind === "clock") {
			prerequisites.push(
				"Owner's active lifetime must expire; Clock availability rules and expiry policy apply.",
			);
		} else prerequisites.push("Owner's finite units must be exhausted.");
		const required: GraphOperationRequirement[] = [
			...participants,
		].map(([node, role]) => ({
			node,
			role,
			effect: participantEffects.find((entry) => entry.node === node)?.effect ?? "preserved",
		}));
		const outputs: GraphOperationOutput[] = [];
		const available =
			availableOperationFn(operation) && required.every(({ node }) => present.has(node));
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
				!available ||
				output === undefined ||
				!present.has(edge.to) ||
				!availableOutputFn(edge, operation)
			)
				continue;
			const outcome = edge.annotations.outcome;
			const table =
				operation.kind === "clock" ? operation.data.onExpire : operation.data.outcome;
			const set = table?.set[edge.annotations.setIndex ?? -1];
			const outputPrerequisites: string[] = [];
			if ((set?.rules.length ?? 0) > 0 || (outcome?.rules.length ?? 0) > 0)
				outputPrerequisites.push("Outcome set and outcome availability rules must pass.");
			if (outcome !== undefined)
				outputPrerequisites.push(
					"Selected outcome must resolve and fit its placement constraints.",
				);
			outputs.push({
				edgeId: edge.id,
				to: edge.to,
				output,
				createdNodes: createdNodesFn(edge, edges, operation),
				prerequisites: outputPrerequisites,
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
			});
		}
		const indexed: GraphIndexedOperation = {
			operation,
			required,
			prerequisites,
			outputs,
		};
		operations.push(indexed);
		if (outputs.length === 0) continue;
		for (const { node } of required) {
			const entries = outgoing.get(node) ?? [];
			entries.push(indexed);
			outgoing.set(node, entries);
		}
	}

	return {
		nodes,
		participants: authoredParticipants,
		operations,
		outgoing,
	};
};
