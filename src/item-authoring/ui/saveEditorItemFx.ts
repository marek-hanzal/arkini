import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { Effect } from "effect";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { publishEditorProjectFx } from "~/ui/editor/publishEditorProjectFx";
import { saveEditorItemWithRepositoryFx } from "~/item-authoring/domain/fx/saveEditorItemWithRepositoryFx";

export namespace saveEditorItemFx {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly projectId: string;
	}
}

/** Atomically validates and saves one UID-owned item into the canonical project. */
export const saveEditorItemFx = Effect.fn("saveEditorItemFx")(function* ({
	item: candidate,
	projectId,
}: saveEditorItemFx.Props) {
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const { commit, item } = yield* saveEditorItemWithRepositoryFx({
				item: candidate,
				projectId,
				repository,
			});
			yield* publishEditorProjectFx(projectId, {
				commit,
			});
			return item;
		}),
	);
});
