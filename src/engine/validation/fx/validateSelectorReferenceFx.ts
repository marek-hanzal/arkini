import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

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
						code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: [
							...path,
							"itemId",
						],
						source,
						message: `Selector references missing item ${itemId}.`,
						reference: DiagnosticRecordEntityEnumSchema.enum.Item,
						referenceId: itemId,
					} satisfies GameDiagnosticSchema.Type,
				];
			},
		)
		.exhaustive();
});
