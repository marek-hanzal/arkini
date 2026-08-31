import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Effect } from "effect";

import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";

export namespace saveFx {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly projectId: string;
	}
}

/** Atomically validates and saves one UID-owned item into the canonical project. */
export const saveFx = Effect.fn("saveFx")(function* ({ item: candidate, projectId }: saveFx.Props) {
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const { commit, item } = yield* saveWithRepositoryFx({
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
