import { Effect } from "effect";

import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { collectMaterialInputEdgesFx } from "../fx/collectMaterialInputEdgesFx";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace validateInputAcceptanceCyclesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Rejects only direct self loops and reciprocal material-acceptance pairs. */
export const validateInputAcceptanceCyclesFx = Effect.fn("validateInputAcceptanceCyclesFx")(
	function* ({ config, provenance }: validateInputAcceptanceCyclesFx.Props) {
		const edges = yield* collectMaterialInputEdgesFx({
			config,
			provenance,
		});
		const byPair = new Map(
			edges.map((edge) => [
				`${edge.ownerItemId}\u0000${edge.acceptedItemId}`,
				edge,
			]),
		);
		const reported = new Set<string>();
		const diagnostics: GameDiagnosticsSchema.Type = [];

		for (const edge of edges) {
			if (edge.ownerItemId === edge.acceptedItemId) {
				const key = `self:${edge.ownerItemId}`;
				if (reported.has(key)) continue;
				reported.add(key);
				diagnostics.push({
					code: DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: edge.path,
					source: edge.source,
					message: `Material input ${edge.ownerItemId} accepts itself.`,
					cycle: [
						edge.ownerItemId,
						edge.ownerItemId,
					],
					edges: [
						edge,
					],
				});
				continue;
			}

			const reverse = byPair.get(`${edge.acceptedItemId}\u0000${edge.ownerItemId}`);
			if (reverse === undefined) continue;
			const pair = [
				edge.ownerItemId,
				edge.acceptedItemId,
			].sort();
			const key = `pair:${pair.join("\u0000")}`;
			if (reported.has(key)) continue;
			reported.add(key);
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: edge.path,
				source: edge.source,
				message: `Material inputs directly accept each other: ${edge.ownerItemId} ↔ ${edge.acceptedItemId}.`,
				cycle: [
					edge.ownerItemId,
					edge.acceptedItemId,
					edge.ownerItemId,
				],
				edges: [
					edge,
					reverse,
				],
			});
		}
		return diagnostics;
	},
);
