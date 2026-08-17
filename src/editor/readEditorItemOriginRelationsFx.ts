import { Effect } from "effect";

import type {
	EditorItemOriginRelation,
	EditorItemOriginSource,
} from "~/editor/EditorItemOriginSource";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const projectEditorItemOriginRelations = (
	source: EditorItemOriginSource,
): EditorItemOriginRelation[] => [
	...unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => left.localeCompare(right))
		.map((itemId) => ({
			fromItemId: itemId,
			role: "input" as const,
			source,
			toItemId: source.ownerItemId,
		})),
	...source.outputs.map((output, outputIndex) => ({
		fromItemId: source.ownerItemId,
		outputIndex,
		role: "output" as const,
		source,
		toItemId: output.itemId,
	})),
];

/** Projects the exact item-to-item edges materialized by the editor origin flow. */
export const readEditorItemOriginRelationsFx = Effect.fn("readEditorItemOriginRelationsFx")(
	(source: EditorItemOriginSource) => Effect.sync(() => projectEditorItemOriginRelations(source)),
);
