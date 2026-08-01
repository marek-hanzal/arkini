import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";

export namespace saveEditorItemFx {
	export interface Props {
		readonly item: EditorItem;
		readonly projectId: string;
	}
}

/** Atomically validates and saves one UID-owned item into the canonical project. */
export const saveEditorItemFx = Effect.fn("saveEditorItemFx")(function* ({
	item: candidate,
	projectId,
}: saveEditorItemFx.Props) {
	const item = yield* Effect.try({
		try: () => ItemSchema.parse(candidate),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-item",
				message: `Item ${candidate.id} does not satisfy its ${candidate.type} schema.`,
				cause,
			}),
	});
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const commit = yield* repository.upsertItemFx({
				projectId,
				item,
			});
			yield* Atom.set(EditorProjectAtom(projectId), {
				commit,
			});
			return item;
		}),
	);
});
