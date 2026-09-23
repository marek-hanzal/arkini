import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { MaterialInputEdgeSchema } from "../schema/MaterialInputEdgeSchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

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

	for (const [ownerItemUid, item] of Object.entries(config.items)) {
		for (const { line, path } of readItemLineEntriesFn({
			itemUid: ownerItemUid,
			item,
		})) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (
					input.type !== TypeSchema.enum.Materials ||
					config.items[input.query.selector.itemUid] === undefined
				)
					continue;
				edges.push({
					ownerItemUid,
					acceptedItemUid: input.query.selector.itemUid,
					path: [
						...path,
						"input",
						inputIndex,
						"selector",
					],
					source: provenance.items[ownerItemUid],
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
			`${edge.ownerItemUid}\u0000${edge.acceptedItemUid}`,
			edge,
		]),
	);
	const reported = new Set<string>();
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const edge of edges) {
		if (edge.ownerItemUid === edge.acceptedItemUid) {
			const key = `self:${edge.ownerItemUid}`;
			if (reported.has(key)) continue;
			reported.add(key);
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: edge.path,
				source: edge.source,
				message: `Material input ${edge.ownerItemUid} accepts itself.`,
				cycle: [
					edge.ownerItemUid,
					edge.ownerItemUid,
				],
				edges: [
					edge,
				],
			});
			continue;
		}

		const reverse = byPair.get(`${edge.acceptedItemUid}\u0000${edge.ownerItemUid}`);
		if (reverse === undefined) continue;
		const pair = [
			edge.ownerItemUid,
			edge.acceptedItemUid,
		].sort();
		const key = `pair:${pair.join("\u0000")}`;
		if (reported.has(key)) continue;
		reported.add(key);
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: edge.path,
			source: edge.source,
			message: `Material inputs directly accept each other: ${edge.ownerItemUid} ↔ ${edge.acceptedItemUid}.`,
			cycle: [
				edge.ownerItemUid,
				edge.acceptedItemUid,
				edge.ownerItemUid,
			],
			edges: [
				edge,
				reverse,
			],
		});
	}
	return diagnostics;
};
