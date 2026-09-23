import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";

export const readItemDeleteImpactFx = Effect.fn("readItemDeleteImpactFx")(function* (
	project: Project,
	itemUid: string,
) {
	const item = project.config.items[itemUid];
	if (item === undefined) return yield* Effect.fail(new Error(`Item ${itemUid} does not exist.`));
	const blockers = readDeleteBlockersFn({
		config: project.config,
		itemUid,
	});
	const forced = yield* forceDeleteFx({
		config: project.config,
		itemUid,
	});
	return {
		blockers,
		impact: forced.impact,
		item,
	};
});
