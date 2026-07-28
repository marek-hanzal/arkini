import { Effect } from "effect";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiTileQuantityPresentation } from "~/ui/pixi/motion/PixiTileQuantityPresentation";
import type { PixiTileMotionTargetRoute } from "~/ui/pixi/motion/PixiTileMotionTargetRoute";
import { readUnsettledTileInputSourceQuantitiesFx } from "~/ui/tile/motion/readUnsettledTileInputSourceQuantitiesFx";

export namespace readPixiTileQuantityPresentationFx {
	export interface Props {
		readonly cues: ReadonlyArray<TileMotionCue>;
		readonly readTargetRoute: (
			actorId: string,
			location: PixiTileMotionTargetRoute["location"],
		) => PixiTileMotionTargetRoute;
		readonly revealedInputCueKeys: ReadonlySet<string>;
	}

	export type Result = ReadonlyMap<string, PixiTileQuantityPresentation>;
}

/**
 * Replays pending quantity choreography in cue order.
 *
 * A later input's previous quantity already includes earlier stack events. Subtracting only stacks
 * queued before that input prevents either committed event from becoming visible before contact.
 */
export const readPixiTileQuantityPresentationFx = Effect.fn("readPixiTileQuantityPresentationFx")(
	function* ({
		cues,
		readTargetRoute,
		revealedInputCueKeys,
	}: readPixiTileQuantityPresentationFx.Props) {
		const presentations = new Map<string, PixiTileQuantityPresentation>();
		const inputQuantities = yield* readUnsettledTileInputSourceQuantitiesFx({
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
			const actorId = readTargetRoute(cue.targetActorId, cue.targetLocation).actorId;
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
		return presentations as readPixiTileQuantityPresentationFx.Result;
	},
);
