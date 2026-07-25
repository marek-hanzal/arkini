import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

/** Bounded actor-lane arbitration snapshot owned by one renderer scene. */
export interface TileMotionLanesState {
	readonly active: ReadonlyArray<TileMotionCue>;
	readonly pending: ReadonlyArray<TileMotionCue>;
}
