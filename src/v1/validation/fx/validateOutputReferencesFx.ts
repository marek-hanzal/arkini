import { Effect } from "effect";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { DropSchema } from "~/v1/output/schema/DropSchema";
import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateWhenReferenceFx } from "./validateWhenReferenceFx";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

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
			code: "config:missing-reference",
			severity: "error",
			path: [
				...path,
				"itemId",
			],
			source,
			message: `Drop references missing item ${drop.itemId}.`,
			reference: "item",
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
			if (roll.type === "guaranteed" || roll.type === "chance") {
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
