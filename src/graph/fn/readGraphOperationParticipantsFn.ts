import { match } from "ts-pattern";
import type { GraphFacts } from "~/graph/type/GraphFacts";

export namespace readGraphOperationParticipantsFn {
	export interface Participant {
		readonly operationId: string;
		readonly nodeId: string;
		readonly role: "owner" | "target" | "input" | "output" | "reference";
	}
}

/** Indexes authored roles, including operations with no edges; guards never become outputs. */
export const readGraphOperationParticipantsFn = (
	facts: GraphFacts,
): readonly readGraphOperationParticipantsFn.Participant[] => {
	const participants = new Map<string, readGraphOperationParticipantsFn.Participant>();
	const addFn = (
		operationId: string,
		nodeId: string,
		role: readGraphOperationParticipantsFn.Participant["role"],
	) => {
		participants.set(
			JSON.stringify([
				operationId,
				nodeId,
				role,
			]),
			{
				operationId,
				nodeId,
				role,
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
			addFn(edge.operationId, participant.nodeId, participant.role);
	}
	return [
		...participants.values(),
	];
};
