import { Effect } from "effect";

import type { GameTransition } from "~/bridge/game/GameSession";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSwapMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import { readGridRuntimeItemFx } from "~/bridge/tile/motion/readGridRuntimeItemFx";
import { readEffectiveGridFootprintFx } from "~/engine/grid/fx/readEffectiveGridFootprintFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";

interface CapturedTileSwapActor {
	readonly id: string;
	readonly revision: string;
	readonly location: TileLocation;
}

export namespace readCommittedTileSwapMotionCueFx {
	export interface Props {
		readonly source: CapturedTileSwapActor;
		readonly target: CapturedTileSwapActor;
		readonly transition: GameTransition;
	}
}

/** Compiles the exchanged target only when one transition exactly commits both captured actors. */
export const readCommittedTileSwapMotionCueFx = Effect.fn("readCommittedTileSwapMotionCueFx")(
	function* ({ source, target, transition }: readCommittedTileSwapMotionCueFx.Props) {
		const [previousSource, previousTarget, currentSource, currentTarget] = yield* Effect.all([
			readGridRuntimeItemFx({
				itemId: source.id,
				runtime: transition.previousRuntime,
			}),
			readGridRuntimeItemFx({
				itemId: target.id,
				runtime: transition.previousRuntime,
			}),
			readGridRuntimeItemFx({
				itemId: source.id,
				runtime: transition.runtime,
			}),
			readGridRuntimeItemFx({
				itemId: target.id,
				runtime: transition.runtime,
			}),
		]);
		if (
			previousSource === null ||
			previousTarget === null ||
			currentSource === null ||
			currentTarget === null ||
			previousSource.revision !== source.revision ||
			previousTarget.revision !== target.revision
		) {
			return null;
		}
		const exactExchange = yield* Effect.all([
			isSameGridLocationFx({
				left: previousSource.location,
				right: source.location,
			}),
			isSameGridLocationFx({
				left: previousTarget.location,
				right: target.location,
			}),
			isSameGridLocationFx({
				left: currentSource.location,
				right: target.location,
			}),
			isSameGridLocationFx({
				left: currentTarget.location,
				right: source.location,
			}),
		]);
		if (exactExchange.includes(false)) return null;
		return {
			kind: "swap",
			sequence: transition.sequence,
			eventIndex: transition.events.length,
			staggerIndex: 0,
			actorId: currentTarget.id,
			counterpartActorId: currentSource.id,
			counterpartOriginFootprint: yield* readEffectiveGridFootprintFx({
				authored: previousSource.item.footprint,
				location: previousSource.location,
			}),
			counterpartTargetFootprint: yield* readEffectiveGridFootprintFx({
				authored: currentSource.item.footprint,
				location: currentSource.location,
			}),
			originActorId: previousTarget.id,
			originFootprint: yield* readEffectiveGridFootprintFx({
				authored: previousTarget.item.footprint,
				location: previousTarget.location,
			}),
			originLocation: previousTarget.location,
			targetFootprint: yield* readEffectiveGridFootprintFx({
				authored: currentTarget.item.footprint,
				location: currentTarget.location,
			}),
			targetLocation: currentTarget.location,
		} satisfies TileSwapMotionCue;
	},
);
