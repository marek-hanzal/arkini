import { readItemTemplateReferencesFn } from "~/game-config-validation/fn/readItemTemplateReferencesFn";
import { match } from "ts-pattern";

import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { InputSchema } from "~/production-action/schema/InputSchema";
import { TypeSchema as InputTypeSchema } from "~/production-input/schema/TypeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

import { readItemLineEntriesFn } from "./readItemLineEntriesFn";
import { readItemOutcomeEntriesFn } from "./readItemOutcomeEntriesFn";

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
	if (config.items[selector.itemUid] !== undefined) return [] as GameDiagnosticsSchema.Type;
	return [
		{
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				...path,
				"itemUid",
			],
			source,
			message: `Selector references missing item ${selector.itemUid}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: selector.itemUid,
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
}) => {
	return validateSelectorReferenceFn({
		config,
		selector: when.query.selector,
		path: [
			...path,
			"query",
			"selector",
		],
		source,
	});
};

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
					selector: input.query.selector,
					path: [
						...path,
						"input",
						inputIndex,
						"query",
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

const validateOutcomeFn = ({
	config,
	drop,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	drop: OutcomeSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];
	if (drop.type === "item" && config.items[drop.itemUid] === undefined) {
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				...path,
				"itemUid",
			],
			source,
			message: `Item outcome references missing item ${drop.itemUid}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Item,
			referenceId: drop.itemUid,
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

const validateOutcomeReferencesFn = ({
	config,
	outcome,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	outcome: OutcomeTableSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) => {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [setIndex, set] of outcome.set.entries()) {
		for (const [ruleIndex, rule] of set.rules.entries()) {
			for (const [whenIndex, when] of rule.when.entries()) {
				diagnostics.push(
					...validateWhenReferenceFn({
						config,
						when,
						source,
						path: [
							...path,
							"set",
							setIndex,
							"rules",
							ruleIndex,
							"when",
							whenIndex,
						],
					}),
				);
			}
		}
		for (const [rollIndex, roll] of set.roll.entries()) {
			for (const [dropIndex, drop] of roll.outcome.entries()) {
				diagnostics.push(
					...validateOutcomeFn({
						config,
						drop,
						source,
						path: [
							...path,
							"set",
							setIndex,
							"roll",
							rollIndex,
							"outcome",
							dropIndex,
						],
					}),
				);
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
	if (!config.start.spaces.some((entry) => entry.space === config.start.currentSpace)) {
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.StartInvalid,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
				"currentSpace",
			],
			source: provenance.start,
			message: `Initial space ${config.start.currentSpace} must have an assigned template before building.`,
			failureTag: "InitialSpaceUnassigned",
		});
	}

	for (const [templateIndex, template] of (config.templates ?? []).entries()) {
		for (const [cellIndex, cell] of template.board.entries()) {
			if (config.items[cell.itemUid] !== undefined) continue;
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: [
					"templates",
					templateIndex,
					"board",
					cellIndex,
					"itemUid",
				],
				source: provenance.templates,
				message: `Template ${template.title} references missing item ${cell.itemUid}.`,
				reference: DiagnosticRecordEntityEnumSchema.enum.Item,
				referenceId: cell.itemUid,
			});
		}
	}

	for (const [index, assignment] of config.start.spaces.entries()) {
		if (config.templates?.some((template) => template.uid === assignment.templateUid)) continue;
		diagnostics.push({
			code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
			severity: DiagnosticSeverityEnumSchema.enum.Error,
			path: [
				"start",
				"spaces",
				index,
				"templateUid",
			],
			source: provenance.start,
			message: `Initial space ${assignment.space} references missing template ${assignment.templateUid}.`,
			reference: DiagnosticRecordEntityEnumSchema.enum.Template,
			referenceId: assignment.templateUid,
		});
	}

	for (const [itemUid, item] of Object.entries(config.items)) {
		const source = provenance.items[itemUid];
		const clock = item.clock;
		if (clock !== undefined) {
			diagnostics.push(
				...validateActionReferencesFn({
					config,
					inputs: [],
					path: [
						"items",
						itemUid,
						"clock",
					],
					rules: clock.rules.map((rule, index) => ({
						rule,
						index,
					})),
					source,
				}),
			);
		}
		for (const reference of readItemTemplateReferencesFn(item)) {
			if (config.templates?.some(({ uid }) => uid === reference.templateUid)) continue;
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: [
					"items",
					itemUid,
					...reference.path,
				],
				source,
				message: `Item references missing template ${reference.templateUid}.`,
				reference: DiagnosticRecordEntityEnumSchema.enum.Template,
				referenceId: reference.templateUid,
			});
		}
		for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
			if (merge.action !== "space")
				diagnostics.push(
					...validateSelectorReferenceFn({
						config,
						selector: merge.target,
						path: [
							"items",
							itemUid,
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
						effect: TargetEffectSchema.enum.Spend,
					},
					() => undefined,
				)
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
								itemUid,
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
			itemUid,
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

		const outputs = readItemOutcomeEntriesFn({
			itemUid,
			item,
		});
		for (const outcome of outputs) {
			diagnostics.push(
				...validateOutcomeReferencesFn({
					config,
					outcome: outcome.outcome,
					path: outcome.path,
					source,
				}),
			);
		}
	}

	return diagnostics;
};
