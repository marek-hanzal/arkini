import { Effect } from "effect";

import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";

/** Cancels one physical visual revision before destroying its private display tree exactly once. */
export const destroyActorVisualFx = Effect.fn("destroyActorVisualFx")(function* (
	visual: ActorVisual,
) {
	if (visual.container.destroyed) return;
	yield* runVisualReadinessFx({
		kind: "cancel",
		visual,
	});
	visual.container.destroy({
		children: true,
	});
});
