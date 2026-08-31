import { Effect } from "effect";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";

export const readItemDeleteImpactFx = Effect.fn("readItemDeleteImpactFx")(function* (
	project: EditorProject,
	itemId: string,
) {
	const item = project.config.items[itemId];
	if (item === undefined) return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
	const blockers = readDeleteBlockersFn({
		config: project.config,
		itemId,
	});
	const forced = yield* forceDeleteFx({
		config: project.config,
		itemId,
	});
	return {
		blockers,
		impact: forced.impact,
		item,
	};
});
