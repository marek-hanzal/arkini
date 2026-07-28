import { Effect } from "effect";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export namespace readUnsettledTileInputSourceQuantitiesFx {
	export interface Props {
		readonly cues: ReadonlyArray<TileMotionCue>;
		readonly revealedCueKeys?: ReadonlySet<string>;
	}

	export type Result = ReadonlyMap<string, number>;
}

/**
 * Keeps each input source at the quantity shown by its oldest unsettled delivery.
 *
 * A source may feed several slots in immediately committed transitions. Only completion of the
 * preceding whole-stack round trip is allowed to reveal the next canonical quantity.
 */
export const readUnsettledTileInputSourceQuantitiesFx = Effect.fn(
	"readUnsettledTileInputSourceQuantitiesFx",
)(({ cues, revealedCueKeys = new Set() }: readUnsettledTileInputSourceQuantitiesFx.Props) =>
	Effect.sync(() => {
		const quantities = new Map<string, number>();
		for (const cue of cues) {
			if (cue.kind !== "input" || quantities.has(cue.sourceActorId)) continue;
			quantities.set(
				cue.sourceActorId,
				revealedCueKeys.has(`${cue.sequence}:${cue.eventIndex}`)
					? cue.resultingQuantity
					: cue.previousQuantity,
			);
		}
		return quantities as readUnsettledTileInputSourceQuantitiesFx.Result;
	}),
);
