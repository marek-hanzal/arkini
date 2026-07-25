import { Effect } from "effect";

const staggerStepSeconds = 0.055;
const maximumStaggerSteps = 4;

/** Keeps one committed delivery batch fluid while preserving readable output order. */
export const readTileMotionStaggerDelaySecondsFx = Effect.fn("readTileMotionStaggerDelaySecondsFx")(
	(staggerIndex: number) =>
		Effect.succeed(Math.min(staggerIndex, maximumStaggerSteps) * staggerStepSeconds),
);
