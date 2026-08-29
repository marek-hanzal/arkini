import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateActionReferencesFn } from "./validateActionReferencesFn";
import { validateSelectorReferenceFn } from "./validateSelectorReferenceFn";

export namespace validateLineReferencesFn {
	export interface Props {
		config: GameConfigSchema.Type;
		line: LineSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates shared action references plus Line-owned material selectors. */
export const validateLineReferencesFn = ({
	config,
	line,
	path,
	source,
}: validateLineReferencesFn.Props) => {
	const actionDiagnostics = validateActionReferencesFn({
		config,
		inputs: line.input.flatMap((input, index) =>
			input.type === TypeSchema.enum.Materials
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
		input.type !== TypeSchema.enum.Materials
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
