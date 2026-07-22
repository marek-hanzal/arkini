import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";
import { readItemOutputEntriesFx } from "../fx/readItemOutputEntriesFx";
import { validateLineReferencesFx } from "../fx/validateLineReferencesFx";
import { validateOutputReferencesFx } from "../fx/validateOutputReferencesFx";
import { validateSelectorReferenceFx } from "../fx/validateSelectorReferenceFx";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

export namespace validateConfigReferencesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates explicit canonical item and category references across a completed config. */
export const validateConfigReferencesFx = Effect.fn("validateConfigReferencesFx")(function* ({
	config,
	provenance,
}: validateConfigReferencesFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [index, value] of config.start.board.entries()) {
		if (config.items[value.itemId] !== undefined) {
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
				"board",
				index,
				"itemId",
			],
			source: provenance.start,
			message: `Initial board references missing item ${value.itemId}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: value.itemId,
		});
	}

	for (const [index, value] of config.start.inventory.entries()) {
		if (config.items[value.itemId] !== undefined) {
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
				"inventory",
				index,
				"itemId",
			],
			source: provenance.start,
			message: `Initial inventory references missing item ${value.itemId}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: value.itemId,
		});
	}

	for (const [itemId, item] of Object.entries(config.items)) {
		const source = provenance.items[itemId];
		if (config.categories[item.categoryId] === undefined) {
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: [
					"items",
					itemId,
					"categoryId",
				],
				source,
				message: `Item ${itemId} references missing category ${item.categoryId}.`,
				reference: DiagnosticRecordEntityEnumSchema.enum.Category,
				referenceId: item.categoryId,
			});
		}

		for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
			diagnostics.push(
				...(yield* validateSelectorReferenceFx({
					config,
					selector: merge.target,
					path: [
						"items",
						itemId,
						"merge",
						mergeIndex,
						"target",
					],
					source,
				})),
			);

			match(merge)
				.with(
					{
						effect: "replace",
					},
					({ result }) => {
						if (config.items[result] !== undefined) {
							return;
						}
						diagnostics.push({
							code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [
								"items",
								itemId,
								"merge",
								mergeIndex,
								"result",
							],
							source,
							message: `Merge result references missing item ${result}.`,
							reference: DiagnosticRecordEntityEnumSchema.enum.Item,
							referenceId: result,
						});
					},
				)
				.with(
					{
						effect: "keep",
					},
					() => undefined,
				)
				.with(
					{
						effect: "remove",
					},
					() => undefined,
				)
				.exhaustive();
		}

		const lines = yield* readItemLineEntriesFx({
			itemId,
			item,
		});
		for (const line of lines) {
			diagnostics.push(
				...(yield* validateLineReferencesFx({
					config,
					line: line.line,
					path: line.path,
					source,
				})),
			);
		}

		const outputs = yield* readItemOutputEntriesFx({
			itemId,
			item,
		});
		for (const output of outputs) {
			diagnostics.push(
				...(yield* validateOutputReferencesFx({
					config,
					output: output.output,
					path: output.path,
					source,
				})),
			);
		}
	}

	return diagnostics;
});
