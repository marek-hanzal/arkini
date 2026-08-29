import { Effect } from "effect";

import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { validateConfigReferencesFn } from "~/game-config/validation/rule/fn/validateConfigReferencesFn";

const replacePath = (
	root: Record<string, unknown>,
	path: ReadonlyArray<string | number>,
	value: string,
) => {
	let current: unknown = root;
	for (const segment of path.slice(0, -1)) {
		if (typeof current !== "object" || current === null)
			throw new Error(`Invalid item reference path ${path.join(".")}.`);
		current = (current as Record<string | number, unknown>)[segment];
	}
	const final = path.at(-1);
	if (final === undefined || typeof current !== "object" || current === null)
		throw new Error(`Invalid item reference path ${path.join(".")}.`);
	(current as Record<string | number, unknown>)[final] = value;
};

/** Renames one canonical item and every exact reference while preserving stable identities. */
export const renameEditorItemFx = Effect.fn("renameEditorItemFx")(function* ({
	config,
	itemId,
	newItemId,
}: {
	readonly config: GameConfigSchema.Type;
	readonly itemId: string;
	readonly newItemId: string;
}) {
	const item = config.items[itemId];
	if (item === undefined) return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
	if (itemId === newItemId)
		return yield* Effect.fail(new Error(`Item ${itemId} already has that ID.`));
	if (config.items[newItemId] !== undefined)
		return yield* Effect.fail(new Error(`Item ${newItemId} already exists.`));

	const items = {
		...config.items,
		[newItemId]: {
			...item,
			id: newItemId,
		},
	};
	delete items[itemId];
	const candidate = {
		...config,
		items,
	};
	const diagnostics = validateConfigReferencesFn({
		config: candidate,
		provenance: {
			items: {},
		},
	});
	const referencePaths = diagnostics.flatMap((diagnostic) =>
		diagnostic.code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference &&
		diagnostic.reference === DiagnosticRecordEntityEnumSchema.enum.Item &&
		diagnostic.referenceId === itemId
			? [
					diagnostic.path,
				]
			: [],
	);
	const renamed = structuredClone(candidate) as Record<string, unknown>;
	for (const path of referencePaths) replacePath(renamed, path, newItemId);

	return {
		config: GameConfigSchema.parse(renamed),
		updatedReferencePaths: referencePaths,
	};
});
