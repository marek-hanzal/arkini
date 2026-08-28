import { Effect } from "effect";

import type { InputSchema } from "~/engine/action/schema/InputSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateSelectorReferenceFx } from "./validateSelectorReferenceFx";
import { validateWhenReferenceFx } from "./validateWhenReferenceFx";

/** Validates selectors shared by immediate action requirements and rules. */
export const validateActionReferencesFx = Effect.fn("validateActionReferencesFx")(function* ({
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
}) {
	const inputDiagnostics = yield* Effect.forEach(inputs, ({ input, index }) =>
		input.type === TypeSchema.enum.Simple
			? Effect.succeed([])
			: validateSelectorReferenceFx({
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
	const ruleDiagnostics = yield* Effect.forEach(rules, ({ index, rule }) =>
		Effect.forEach(rule.when, (when, whenIndex) =>
			validateWhenReferenceFx({
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
});
