import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { SelectorSchema } from "~/v1/selector/schema/SelectorSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";

export namespace validateSelectorReferenceFx {
	export interface Props {
		config: GameConfigSchema.Type;
		selector: SelectorSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates the explicit canonical item reference owned by one selector. */
export const validateSelectorReferenceFx = Effect.fn("validateSelectorReferenceFx")(function* ({
	config,
	selector,
	path,
	source,
}: validateSelectorReferenceFx.Props) {
	return match(selector)
		.with(
			{
				type: "tag",
			},
			() => [] as GameDiagnosticsSchema.Type,
		)
		.with(
			{
				type: "item",
			},
			({ itemId }) => {
				if (config.items[itemId] !== undefined) {
					return [] as GameDiagnosticsSchema.Type;
				}

				return [
					{
						code: "config:missing-reference",
						severity: "error",
						path: [
							...path,
							"itemId",
						],
						source,
						message: `Selector references missing item ${itemId}.`,
						reference: "item",
						referenceId: itemId,
					} satisfies GameDiagnosticSchema.Type,
				];
			},
		)
		.exhaustive();
});
