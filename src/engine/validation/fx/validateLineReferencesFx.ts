import { Effect } from "effect";

import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateActionReferencesFx } from "./validateActionReferencesFx";
import { validateSelectorReferenceFx } from "./validateSelectorReferenceFx";

export namespace validateLineReferencesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		line: LineSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates shared action references plus Line-owned material selectors. */
export const validateLineReferencesFx = Effect.fn("validateLineReferencesFx")(function* ({
	config,
	line,
	path,
	source,
}: validateLineReferencesFx.Props) {
	const actionDiagnostics = yield* validateActionReferencesFx({
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
	const materialDiagnostics = yield* Effect.forEach(line.input, (input, inputIndex) =>
		input.type !== TypeSchema.enum.Materials
			? Effect.succeed([])
			: validateSelectorReferenceFx({
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
});
