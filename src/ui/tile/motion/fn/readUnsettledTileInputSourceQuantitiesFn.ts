import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";

interface ReadUnsettledTileInputSourceQuantitiesProps {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly revealedCueKeys?: ReadonlySet<string>;
}

/**
 * Keeps each input source at the quantity shown by its oldest unsettled delivery.
 *
 * A source may feed several slots in immediately committed transitions. Only completion of the
 * preceding whole-stack round trip is allowed to reveal the next canonical quantity.
 */
export const readUnsettledTileInputSourceQuantitiesFn = ({
	cues,
	revealedCueKeys = new Set(),
}: ReadUnsettledTileInputSourceQuantitiesProps): ReadonlyMap<string, number> => {
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
	return quantities;
};
