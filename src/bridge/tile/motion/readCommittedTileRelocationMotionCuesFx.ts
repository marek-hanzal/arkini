import { Effect } from "effect";

import type { GameTransition } from "~/bridge/game/GameSession";
import type { TileRelocationMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readGridRuntimeItemFx } from "~/bridge/tile/motion/readGridRuntimeItemFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";

interface CapturedRelocation {
	readonly itemId: string;
	readonly revision: string;
	readonly previousLocation: GridLocationSchema.Type;
	readonly location: GridLocationSchema.Type;
}

export namespace readCommittedTileRelocationMotionCuesFx {
	export interface Props {
		readonly relocations: ReadonlyArray<CapturedRelocation>;
		readonly transition: GameTransition;
	}
}

/**
 * Compiles ordered item-level motion only when the supplied result still describes this commit.
 *
 * Missing identities and stale/superseded facts are omitted so canonical reconciliation remains
 * the ordinary fallback instead of presentation inventing a replacement path.
 */
export const readCommittedTileRelocationMotionCuesFx = Effect.fn(
	"readCommittedTileRelocationMotionCuesFx",
)(function* ({ relocations, transition }: readCommittedTileRelocationMotionCuesFx.Props) {
	return yield* Effect.reduce(
		relocations,
		() => [] as TileRelocationMotionCue[],
		(cues, relocation, relocationIndex) =>
			Effect.gen(function* () {
				const [previous, current] = yield* Effect.all([
					readGridRuntimeItemFx({
						itemId: relocation.itemId,
						runtime: transition.previousRuntime,
					}),
					readGridRuntimeItemFx({
						itemId: relocation.itemId,
						runtime: transition.runtime,
					}),
				]);
				if (
					previous === null ||
					current === null ||
					current.revision !== relocation.revision ||
					!(yield* isSameGridLocationFx({
						left: previous.location,
						right: relocation.previousLocation,
					})) ||
					!(yield* isSameGridLocationFx({
						left: current.location,
						right: relocation.location,
					}))
				) {
					return cues;
				}
				cues.push({
					actorId: relocation.itemId,
					eventIndex: transition.events.length + relocationIndex,
					kind: "relocation",
					originActorId: relocation.itemId,
					originFootprint: yield* readEffectiveGridFootprintFx({
						authored: previous.item.footprint,
						location: previous.location,
					}),
					originLocation: relocation.previousLocation,
					sequence: transition.sequence,
					staggerIndex: 0,
					targetFootprint: yield* readEffectiveGridFootprintFx({
						authored: current.item.footprint,
						location: current.location,
					}),
					targetLocation: relocation.location,
				});
				return cues;
			}),
	);
});
