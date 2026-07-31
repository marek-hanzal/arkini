import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { validateEditorItem } from "~/bridge/editor/EditorItemModel";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace stageEditorItemMutation {
	export interface Variables {
		readonly item: unknown;
		readonly projectId: string;
		readonly sourceItemId?: string;
		readonly sourcePath?: string;
	}
}

export const stageEditorItemMutationFx = Effect.fn("stageEditorItemMutationFx")(
	(variables: stageEditorItemMutation.Variables) =>
		Effect.gen(function* () {
			const parsed = validateEditorItem(variables.item);
			if (!parsed.success) {
				return yield* Effect.fail(
					new EditorProjectError({
						reason: "unsupported-project-file",
						message: parsed.error.issues.map((issue) => issue.message).join(" "),
						cause: parsed.error,
					}),
				);
			}
			const key = variables.sourceItemId ?? parsed.data.id;
			const change = {
				item: parsed.data,
				sourceItemId: variables.sourceItemId,
				sourcePath: variables.sourcePath,
			};
			yield* Atom.set(EditorProjectDraftAtom(variables.projectId), {
				action: "stage",
				change,
				key,
			});
			return parsed.data;
		}),
);
