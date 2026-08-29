import { match } from "ts-pattern";

import type { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import type { DiagnosticPathSchema } from "~/game-config/diagnostic/schema/DiagnosticPathSchema";
import type { GameDiagnosticSchema } from "~/game-config/diagnostic/schema/GameDiagnosticSchema";
import type { InputSchema } from "~/engine/action/schema/InputSchema";
import { TypeSchema as InputTypeSchema } from "~/engine/input/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { TypeSchema as RollTypeSchema } from "~/engine/roll/schema/TypeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

import { readItemLineEntriesFn } from "../../fn/readItemLineEntriesFn";
import { readItemOutputEntriesFn } from "../../fn/readItemOutputEntriesFn";

const validateSelectorReferenceFn = ({
	config,
	selector,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	selector: SelectorSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	if (config.items[selector.itemId] !== undefined) return [] as GameDiagnosticsSchema.Type;
	return [
		{
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				...path,
				"itemId",
			],
			source,
			message: `Selector references missing item ${selector.itemId}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: selector.itemId,
		} satisfies GameDiagnosticSchema.Type,
	];
};

const validateWhenReferenceFn = ({
	config,
	when,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	when: WhenSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) =>
	validateSelectorReferenceFn({
		config,
		selector: when.query.selector,
		path: [
			...path,
			"query",
			"selector",
		],
		source,
	});

const validateActionReferencesFn = ({
	config,
	inputs,
	path,
	rules,
	source,
}: {
	config: GameConfigSchema.Type;
	inputs: ReadonlyArray<{
		input: InputSchema.Type;
		index: number;
	}>;
	path: DiagnosticPathSchema.Type;
	rules: ReadonlyArray<{
		index: number;
		rule: {
			when: ReadonlyArray<WhenSchema.Type>;
		};
	}>;
	source?: string;
}) => {
	const inputDiagnostics = inputs.map(({ input, index }) =>
		input.type === InputTypeSchema.enum.Simple
			? []
			: validateSelectorReferenceFn({
					config,
					selector: input.query.selector,
					path: [
						...path,
						"input",
						index,
						"query",
						"selector",
					],
					source,
				}),
	);
	const ruleDiagnostics = rules.map(({ index, rule }) =>
		rule.when.map((when, whenIndex) =>
			validateWhenReferenceFn({
				config,
				when,
				path: [
					...path,
					"rules",
					index,
					"when",
					whenIndex,
				],
				source,
			}),
		),
	);
	return [
		...inputDiagnostics.flat(),
		...ruleDiagnostics.flat(2),
	];
};

const validateLineReferencesFn = ({
	config,
	line,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	line: LineSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	const actionDiagnostics = validateActionReferencesFn({
		config,
		inputs: line.input.flatMap((input, index) =>
			input.type === InputTypeSchema.enum.Materials
				? []
				: [
						{
							input,
							index,
						},
					],
		),
		path,
		rules: line.rules.map((rule, index) => ({
			index,
			rule,
		})),
		source,
	});
	const materialDiagnostics = line.input.map((input, inputIndex) =>
		input.type !== InputTypeSchema.enum.Materials
			? []
			: validateSelectorReferenceFn({
					config,
					selector: input.selector,
					path: [
						...path,
						"input",
						inputIndex,
						"selector",
					],
					source,
				}),
	);
	return [
		...actionDiagnostics,
		...materialDiagnostics.flat(),
	];
};

const validateDropFn = ({
	config,
	drop,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	drop: DropSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	if (config.items[drop.itemId] === undefined) {
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				...path,
				"itemId",
			],
			source,
			message: `Drop references missing item ${drop.itemId}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: drop.itemId,
		});
	}

	const ruleDiagnostics = drop.rules.map((rule, ruleIndex) =>
		rule.when.map((when, whenIndex) =>
			validateWhenReferenceFn({
				config,
				when,
				path: [
					...path,
					"rules",
					ruleIndex,
					"when",
					whenIndex,
				],
				source,
			}),
		),
	);

	return [
		...diagnostics,
		...ruleDiagnostics.flat(2),
	];
};

const validateOutputReferencesFn = ({
	config,
	output,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	output: OutputSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [setIndex, set] of output.set.entries()) {
		for (const [rollIndex, roll] of set.roll.entries()) {
			if (
				roll.type === RollTypeSchema.enum.Guaranteed ||
				roll.type === RollTypeSchema.enum.Chance
			) {
				for (const [dropIndex, drop] of roll.drop.entries()) {
					diagnostics.push(
						...validateDropFn({
							config,
							drop,
							path: [
								...path,
								"set",
								setIndex,
								"roll",
								rollIndex,
								"drop",
								dropIndex,
							],
							source,
						}),
					);
				}
				continue;
			}

			for (const [candidateIndex, candidate] of roll.drop.entries()) {
				for (const [dropIndex, drop] of candidate.drop.entries()) {
					diagnostics.push(
						...validateDropFn({
							config,
							drop,
							path: [
								...path,
								"set",
								setIndex,
								"roll",
								rollIndex,
								"drop",
								candidateIndex,
								"drop",
								dropIndex,
							],
							source,
						}),
					);
				}
			}
		}
	}

	return diagnostics;
};

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
