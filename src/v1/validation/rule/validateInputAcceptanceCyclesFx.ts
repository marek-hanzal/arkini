import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { MaterialInputEdgeSchema } from "../schema/MaterialInputEdgeSchema";
import { collectMaterialInputEdgesFx } from "../fx/collectMaterialInputEdgesFx";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace validateInputAcceptanceCyclesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

const readCycleKey = (cycle: ReadonlyArray<IdSchema.Type>) => {
	const nodes = cycle.slice(0, -1);
	const rotations = nodes.map((_, index) =>
		[
			...nodes.slice(index),
			...nodes.slice(0, index),
		].join("→"),
	);

	return rotations.sort()[0] ?? "";
};

/** Rejects self and multi-item cycles allowed by expanded material-input selectors. */
export const validateInputAcceptanceCyclesFx = Effect.fn("validateInputAcceptanceCyclesFx")(
	function* ({ config, provenance }: validateInputAcceptanceCyclesFx.Props) {
		const edges = yield* collectMaterialInputEdgesFx({
			config,
			provenance,
		});
		const adjacency: Record<IdSchema.Type, MaterialInputEdgeSchema.Type[]> = {};
		for (const edge of edges) {
			adjacency[edge.ownerItemId] = [
				...(adjacency[edge.ownerItemId] ?? []),
				edge,
			];
		}

		const state: Record<IdSchema.Type, "visiting" | "done" | undefined> = {};
		const nodeStack: IdSchema.Type[] = [];
		const edgeStack: MaterialInputEdgeSchema.Type[] = [];
		const reported = new Set<string>();
		const diagnostics: GameDiagnosticsSchema.Type = [];

		const visit = (itemId: IdSchema.Type): void => {
			state[itemId] = "visiting";
			nodeStack.push(itemId);

			for (const edge of adjacency[itemId] ?? []) {
				const targetState = state[edge.acceptedItemId];
				if (targetState === undefined) {
					edgeStack.push(edge);
					visit(edge.acceptedItemId);
					edgeStack.pop();
					continue;
				}
				if (targetState !== "visiting") {
					continue;
				}

				const cycleStart = nodeStack.indexOf(edge.acceptedItemId);
				if (cycleStart < 0) {
					continue;
				}
				const cycle = [
					...nodeStack.slice(cycleStart),
					edge.acceptedItemId,
				];
				const cycleEdges = [
					...edgeStack.slice(cycleStart),
					edge,
				];
				const key = readCycleKey(cycle);
				if (reported.has(key)) {
					continue;
				}
				reported.add(key);

				const firstEdge = cycleEdges[0] ?? edge;
				diagnostics.push({
					code: "input:acceptance-cycle",
					severity: "error",
					path: firstEdge.path,
					source: firstEdge.source,
					message: `Material input acceptance cycle detected: ${cycle.join(" → ")}.`,
					cycle,
					edges: cycleEdges,
				});
			}

			nodeStack.pop();
			state[itemId] = "done";
		};

		for (const itemId of Object.keys(config.items)) {
			if (state[itemId] === undefined) {
				visit(itemId);
			}
		}

		return diagnostics;
	},
);
