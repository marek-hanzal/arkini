import { Effect } from "effect";
import { match } from "ts-pattern";

import { SelectorEnumSchema } from "~/engine/selector/schema/SelectorEnumSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";

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
				type: SelectorEnumSchema.enum.Tag,
			},
			() => [] as GameDiagnosticsSchema.Type,
		)
		.with(
			{
				type: SelectorEnumSchema.enum.Item,
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
