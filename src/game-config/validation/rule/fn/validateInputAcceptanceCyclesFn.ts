import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { MaterialInputEdgeSchema } from "../../schema/MaterialInputEdgeSchema";
import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";

export namespace validateInputAcceptanceCyclesFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

const collectMaterialInputEdgesFn = ({
	config,
	provenance,
}: validateInputAcceptanceCyclesFn.Props) => {
	const edges: MaterialInputEdgeSchema.Type[] = [];

	for (const [ownerItemId, item] of Object.entries(config.items)) {
		for (const { line, path } of readItemLineEntriesFn({
			itemId: ownerItemId,
			item,
		})) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (
					input.type !== TypeSchema.enum.Materials ||
					config.items[input.selector.itemId] === undefined
				)
					continue;
				edges.push({
					ownerItemId,
					acceptedItemId: input.selector.itemId,
					path: [
						...path,
						"input",
						inputIndex,
						"selector",
					],
					source: provenance.items[ownerItemId],
				});
			}
		}
	}

	return edges;
};

/** Rejects only direct self loops and reciprocal material-acceptance pairs. */
export const validateInputAcceptanceCyclesFn = ({
	config,
	provenance,
}: validateInputAcceptanceCyclesFn.Props) => {
	const edges = collectMaterialInputEdgesFn({
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
};
