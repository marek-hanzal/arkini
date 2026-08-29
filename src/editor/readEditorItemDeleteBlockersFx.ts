import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";
import { validateConfigReferencesFn } from "~/engine/validation/rule/fn/validateConfigReferencesFn";

export interface EditorItemDeleteBlocker {
	readonly message: string;
	readonly path: ReadonlyArray<string | number>;
}

export namespace readEditorItemDeleteBlockersFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly itemId: string;
	}
}

/** Finds references that would become invalid if one item disappeared. */
export const readEditorItemDeleteBlockersFx = Effect.fn("readEditorItemDeleteBlockersFx")(
	function* ({ config, itemId }: readEditorItemDeleteBlockersFx.Props) {
		const items = {
			...config.items,
		};
		delete items[itemId];
		const diagnostics = validateConfigReferencesFn({
			config: {
				...config,
				items,
			},
			provenance: {
				items: {},
			},
		});
		return diagnostics.flatMap(
			(diagnostic): ReadonlyArray<EditorItemDeleteBlocker> =>
				diagnostic.code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference &&
				diagnostic.reference === DiagnosticRecordEntityEnumSchema.enum.Item &&
				diagnostic.referenceId === itemId
					? [
							{
								message: diagnostic.message.replace(
									`missing item ${itemId}`,
									"this item",
								),
								path: diagnostic.path,
							},
						]
					: [],
		);
	},
);
