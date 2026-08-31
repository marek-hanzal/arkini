import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { forceDeleteEditorItemFx } from "~/item-authoring/fx/forceDeleteEditorItemFx";
import { readEditorItemDeleteBlockersFn } from "~/item-authoring/fn/readEditorItemDeleteBlockersFn";

export const readItemDeleteImpactFx = Effect.fn("readItemDeleteImpactFx")(function* (
	project: EditorProject,
	itemId: string,
) {
	const item = project.config.items[itemId];
	if (item === undefined) return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
	const blockers = readEditorItemDeleteBlockersFn({
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
