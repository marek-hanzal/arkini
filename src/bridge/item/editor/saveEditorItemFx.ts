import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemWithRepositoryFx } from "~/editor/saveEditorItemWithRepositoryFx";

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
