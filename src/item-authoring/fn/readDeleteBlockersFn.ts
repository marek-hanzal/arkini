import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { validateConfigReferencesFn } from "~/game-config-validation/fn/validateConfigReferencesFn";

export namespace readDeleteBlockersFn {
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
export const readDeleteBlockersFn = ({
	config,
	itemId,
}: readDeleteBlockersFn.Props): ReadonlyArray<readDeleteBlockersFn.Blocker> => {
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
		(diagnostic): ReadonlyArray<readDeleteBlockersFn.Blocker> =>
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
