import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { validateConfigReferencesFn } from "~/game-config/validation/rule/fn/validateConfigReferencesFn";

export namespace readEditorItemDeleteBlockersFn {
	export interface Blocker {
		readonly message: string;
		readonly path: ReadonlyArray<string | number>;
	}

	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly itemId: string;
	}
}

/** Finds references that would become invalid if one item disappeared. */
export const readEditorItemDeleteBlockersFn = ({
	config,
	itemId,
}: readEditorItemDeleteBlockersFn.Props): ReadonlyArray<readEditorItemDeleteBlockersFn.Blocker> => {
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
		(diagnostic): ReadonlyArray<readEditorItemDeleteBlockersFn.Blocker> =>
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
};
