import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import { forceDeleteEditorItemFx } from "~/editor/forceDeleteEditorItemFx";
import { readEditorItemDeleteBlockersFx } from "~/editor/readEditorItemDeleteBlockersFx";

export const readItemDeleteImpactFx = Effect.fn("readItemDeleteImpactFx")(function* (
	project: EditorProject,
	itemId: string,
) {
	const item = project.config.items[itemId];
	if (item === undefined) return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
	const blockers = yield* readEditorItemDeleteBlockersFx({
		config: project.config,
		itemId,
	});
	const forced = yield* forceDeleteEditorItemFx({
		config: project.config,
		itemId,
	});
	return {
		blockers,
		impact: forced.impact,
		item,
	};
});
