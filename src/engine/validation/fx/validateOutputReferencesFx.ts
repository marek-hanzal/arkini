import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";

import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateWhenReferenceFx } from "./validateWhenReferenceFx";

export namespace validateOutputReferencesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		output: OutputSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

const validateDropFx = Effect.fn("validateOutputDropReferencesFx")(function* ({
	config,
	drop,
	path,
	source,
}: {
	config: GameConfigSchema.Type;
	drop: DropSchema.Type;
	path: DiagnosticPathSchema.Type;
	source?: string;
}) {
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

	const ruleDiagnostics = yield* Effect.forEach(drop.rules, (rule, ruleIndex) =>
		Effect.forEach(rule.when, (when, whenIndex) =>
			validateWhenReferenceFx({
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
});

/** Validates every canonical item reference reachable from one output. */
export const validateOutputReferencesFx = Effect.fn("validateOutputReferencesFx")(function* ({
	config,
	output,
	path,
	source,
}: validateOutputReferencesFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [setIndex, set] of output.set.entries()) {
		for (const [rollIndex, roll] of set.roll.entries()) {
			if (
				roll.type === RollEnumSchema.enum.Guaranteed ||
				roll.type === RollEnumSchema.enum.Chance
			) {
				for (const [dropIndex, drop] of roll.drop.entries()) {
					diagnostics.push(
						...(yield* validateDropFx({
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
						})),
					);
				}
				continue;
			}

			for (const [candidateIndex, candidate] of roll.drop.entries()) {
				for (const [dropIndex, drop] of candidate.drop.entries()) {
					diagnostics.push(
						...(yield* validateDropFx({
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
						})),
					);
				}
			}
		}
	}

	return diagnostics;
});
