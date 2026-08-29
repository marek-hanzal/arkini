import type { InputSchema } from "~/engine/action/schema/InputSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateSelectorReferenceFn } from "./validateSelectorReferenceFn";
import { validateWhenReferenceFn } from "./validateWhenReferenceFn";

/** Validates selectors shared by immediate action requirements and rules. */
export const validateActionReferencesFn = ({
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
		input.type === TypeSchema.enum.Simple
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
