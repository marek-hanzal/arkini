import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace stageEditorItemMutation {
	export interface Variables {
		readonly item: EditorItem;
		readonly projectId: string;
	}
}

/** Validates and stages one complete item without touching the filesystem. */
export const stageEditorItemMutationFx = Effect.fn("stageEditorItemMutationFx")(
	(variables: stageEditorItemMutation.Variables) =>
		Effect.gen(function* () {
			const item = yield* Effect.try({
				try: () => ItemSchema.parse(variables.item),
				catch: (cause) =>
					new EditorProjectError({
						reason: "unsupported-project-file",
						message: `Item ${variables.item.id} is not valid.`,
						cause,
					}),
			});
			const project = yield* Atom.get(EditorProjectAtom(variables.projectId));
			const staged = yield* Atom.get(EditorProjectDraftAtom(variables.projectId));
			const conflictingItem =
				Object.values(staged).find((candidate) => candidate.id === item.id) ??
				project?.config?.items[item.id];
			if (conflictingItem !== undefined && conflictingItem.uid !== item.uid) {
				return yield* Effect.fail(
					new EditorProjectError({
						reason: "unsupported-project-file",
						message: `Item ID ${item.id} is already used by another item.`,
					}),
				);
			}
			yield* Atom.set(EditorProjectDraftAtom(variables.projectId), {
				action: "stage",
				item,
			});
			return item;
		}),
);
