import { match } from "ts-pattern";

import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";

import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";
import { readItemOutputEntriesFn } from "../../fn/readItemOutputEntriesFn";
import { validateLineReferencesFn } from "../../fn/validateLineReferencesFn";
import { validateActionReferencesFn } from "../../fn/validateActionReferencesFn";
import { validateOutputReferencesFn } from "../../fn/validateOutputReferencesFn";
import { validateSelectorReferenceFn } from "../../fn/validateSelectorReferenceFn";

export namespace validateConfigReferencesFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates explicit canonical item references across a completed config. */
export const validateConfigReferencesFn = ({
	config,
	provenance,
}: validateConfigReferencesFn.Props) => {
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

	for (const [index, value] of config.start.toolbar.entries()) {
		if (config.items[value.itemId] !== undefined) {
			continue;
		}
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
				"toolbar",
				index,
				"itemId",
			],
			source: provenance.start,
			message: `Initial toolbar references missing item ${value.itemId}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: value.itemId,
		});
	}

	for (const [itemId, item] of Object.entries(config.items)) {
		const source = provenance.items[itemId];
		if (item.type === "space") {
			diagnostics.push(
				...validateActionReferencesFn({
					config,
					inputs: item.input.map((input, index) => ({
						input,
						index,
					})),
					path: [
						"items",
						itemId,
					],
					rules: item.rules.map((rule, index) => ({
						index,
						rule,
					})),
					source,
				}),
			);
		}
		for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
			diagnostics.push(
				...validateSelectorReferenceFn({
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
				}),
			);

			match(merge)
				.with(
					{
						effect: TargetEffectSchema.enum.Replace,
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
						effect: TargetEffectSchema.enum.Keep,
					},
					() => undefined,
				)
				.with(
					{
						effect: TargetEffectSchema.enum.Remove,
					},
					() => undefined,
				)
				.exhaustive();
		}

		const lines = readItemLineEntriesFn({
			itemId,
			item,
		});
		for (const line of lines) {
			diagnostics.push(
				...validateLineReferencesFn({
					config,
					line: line.line,
					path: line.path,
					source,
				}),
			);
		}

		const outputs = readItemOutputEntriesFn({
			itemId,
			item,
		});
		for (const output of outputs) {
			diagnostics.push(
				...validateOutputReferencesFn({
					config,
					output: output.output,
					path: output.path,
					source,
				}),
			);
		}
	}

	return diagnostics;
};
