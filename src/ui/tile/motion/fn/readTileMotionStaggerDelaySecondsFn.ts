const staggerStepSeconds = 0.055;
const maximumStaggerSteps = 4;

/** Keeps one committed delivery batch fluid while preserving readable output order. */
export const readTileMotionStaggerDelaySecondsFn = (staggerIndex: number) =>
	Math.min(staggerIndex, maximumStaggerSteps) * staggerStepSeconds;
