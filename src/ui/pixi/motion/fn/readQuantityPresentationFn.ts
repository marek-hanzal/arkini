import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import type { QuantityPresentation } from "~/ui/pixi/motion/QuantityPresentation";
import { readUnsettledTileInputSourceQuantitiesFn } from "~/ui/tile/motion/fn/readUnsettledTileInputSourceQuantitiesFn";

interface ReadQuantityPresentationProps {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly resolvedTargetActorIdByCueKey: ReadonlyMap<string, string>;
	readonly revealedInputCueKeys: ReadonlySet<string>;
}

/**
 * Replays pending quantity choreography in cue order.
 *
 * A later input's previous quantity already includes earlier stack events. Subtracting only stacks
 * queued before that input prevents either committed event from becoming visible before contact.
 */
export const readQuantityPresentationFn = ({
	cues,
	resolvedTargetActorIdByCueKey,
	revealedInputCueKeys,
}: ReadQuantityPresentationProps): ReadonlyMap<string, QuantityPresentation> => {
	const presentations = new Map<string, QuantityPresentation>();
	const inputQuantities = readUnsettledTileInputSourceQuantitiesFn({
		cues,
		revealedCueKeys: revealedInputCueKeys,
	});
	const firstInputIndexByActorId = new Map<string, number>();
	for (const [index, cue] of cues.entries()) {
		if (cue.kind !== "input" || firstInputIndexByActorId.has(cue.sourceActorId)) continue;
		firstInputIndexByActorId.set(cue.sourceActorId, index);
	}
	const hiddenStackQuantities = new Map<string, number>();
	for (const [index, cue] of cues.entries()) {
		if (cue.kind !== "stack") continue;
		const actorId =
			resolvedTargetActorIdByCueKey.get(`${cue.sequence}:${cue.eventIndex}`) ??
			cue.targetActorId;
		const firstInputIndex = firstInputIndexByActorId.get(actorId);
		if (firstInputIndex !== undefined && index >= firstInputIndex) continue;
		hiddenStackQuantities.set(
			actorId,
			(hiddenStackQuantities.get(actorId) ?? 0) + cue.quantity,
		);
	}
	for (const [actorId, quantity] of inputQuantities) {
		presentations.set(actorId, {
			kind: "exact",
			quantity: Math.max(1, quantity - (hiddenStackQuantities.get(actorId) ?? 0)),
		});
		hiddenStackQuantities.delete(actorId);
	}
	for (const [actorId, quantity] of hiddenStackQuantities) {
		presentations.set(actorId, {
			kind: "subtract",
			quantity,
		});
	}
	return presentations;
};
