import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateSelectorReferenceFx } from "./validateSelectorReferenceFx";
import { validateWhenReferenceFx } from "./validateWhenReferenceFx";

export namespace validateLineReferencesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		line: LineSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates selectors used by one line's inputs and availability rules. */
export const validateLineReferencesFx = Effect.fn("validateLineReferencesFx")(function* ({
	config,
	line,
	path,
	source,
}: validateLineReferencesFx.Props) {
	const inputDiagnostics = yield* Effect.forEach(line.input, (input, inputIndex) =>
		match(input)
			.with(
				{
					type: "simple",
				},
				() => Effect.succeed([]),
			)
			.with(
				{
					type: "materials",
				},
				({ selector }) =>
					validateSelectorReferenceFx({
						config,
						selector,
						path: [
							...path,
							"input",
							inputIndex,
							"selector",
						],
						source,
					}),
			)
			.with(
				{
					type: "deposit",
				},
				({ query }) =>
					validateSelectorReferenceFx({
						config,
						selector: query.selector,
						path: [
							...path,
							"input",
							inputIndex,
							"query",
							"selector",
						],
						source,
					}),
			)
			.exhaustive(),
	);
	const ruleDiagnostics = yield* Effect.forEach(line.rules, (rule, ruleIndex) =>
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
		...inputDiagnostics.flat(),
		...ruleDiagnostics.flat(2),
	];
});
