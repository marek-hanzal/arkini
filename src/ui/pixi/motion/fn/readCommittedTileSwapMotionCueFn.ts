import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GameTransition } from "~/renderer/game/session/GameSession";
import type { TileSwapMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import { readGridRuntimeItemFn } from "~/ui/pixi/motion/fn/readGridRuntimeItemFn";

interface CapturedTileSwapActor {
	readonly id: string;
	readonly revision: string;
	readonly location: GridLocationSchema.Type;
}

export namespace readCommittedTileSwapMotionCueFn {
	export interface Props {
		readonly source: CapturedTileSwapActor;
		readonly target: CapturedTileSwapActor;
		readonly transition: GameTransition;
	}
}

/** Compiles the exchanged target only when one transition exactly commits both captured actors. */
export const readCommittedTileSwapMotionCueFn = ({
	source,
	target,
	transition,
}: readCommittedTileSwapMotionCueFn.Props) => {
	const previousSource = readGridRuntimeItemFn({
		itemId: source.id,
		runtime: transition.previousRuntime,
	});
	const previousTarget = readGridRuntimeItemFn({
		itemId: target.id,
		runtime: transition.previousRuntime,
	});
	const currentSource = readGridRuntimeItemFn({
		itemId: source.id,
		runtime: transition.runtime,
	});
	const currentTarget = readGridRuntimeItemFn({
		itemId: target.id,
		runtime: transition.runtime,
	});
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
	const exactExchange = [
		isSameGridLocationFn({
			left: previousSource.location,
			right: source.location,
		}),
		isSameGridLocationFn({
			left: previousTarget.location,
			right: target.location,
		}),
		isSameGridLocationFn({
			left: currentSource.location,
			right: target.location,
		}),
		isSameGridLocationFn({
			left: currentTarget.location,
			right: source.location,
		}),
	];
	if (exactExchange.includes(false)) return null;
	return {
		kind: "swap",
		sequence: transition.sequence,
		eventIndex: transition.events.length,
		staggerIndex: 0,
		actorId: currentTarget.id,
		counterpartActorId: currentSource.id,
		originActorId: previousTarget.id,
		originLocation: previousTarget.location,
		targetLocation: currentTarget.location,
	} satisfies TileSwapMotionCue;
};
