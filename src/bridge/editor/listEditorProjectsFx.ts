import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";

/** Lists canonical IndexedDB projects in recent order. */
export const listEditorProjectsFx = Effect.fn("listEditorProjectsFx")(function* () {
	const repository = yield* EditorProjectRepository;
	return yield* repository.listProjectsFx;
});
