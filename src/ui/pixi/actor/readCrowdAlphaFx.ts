import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

const activeCraftAlpha = 0.6;
const runningLineOwnerAlpha = 0.82;

/** Keeps active crafts visibly unavailable while preserving the lighter running treatment elsewhere. */
export const readCrowdAlphaFx = Effect.fnUntraced(function* (item: TileActorItem) {
	return match({
		active: item.jobStatus !== undefined,
		itemType: item.itemType,
		running: item.running,
	})
		.with(
			{
				active: true,
				itemType: "craft",
			},
			() => activeCraftAlpha,
		)
		.with(
			{
				running: true,
			},
			() => runningLineOwnerAlpha,
		)
		.otherwise(() => 1);
});
