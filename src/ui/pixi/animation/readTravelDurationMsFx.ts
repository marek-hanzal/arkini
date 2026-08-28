import { Effect } from "effect";

import { readTileTravelDurationFx } from "~/ui/tile/physics/readTileTravelDurationFx";

export namespace readTravelDurationMsFx {
	export interface Props {
		readonly fromX: number;
		readonly fromY: number;
		readonly tileSize: number;
		readonly toX: number;
		readonly toY: number;
	}
}

const maximumSpeedTilesPerSecond = 12;
const maximumAccelerationTilesPerSecondSquared = 80;
const minimumTravelDurationMs = 280;

/** Derives a distance-sensitive tile duration with bounded speed and acceleration. */
export const readTravelDurationMsFx = Effect.fn("readTravelDurationMsFx")(function* ({
	fromX,
	fromY,
	tileSize,
	toX,
	toY,
}: readTravelDurationMsFx.Props) {
	const travel = yield* readTileTravelDurationFx({
		distancePx: Math.hypot(toX - fromX, toY - fromY),
		maxAccelerationTilesPerSecondSquared: maximumAccelerationTilesPerSecondSquared,
		maxSpeedTilesPerSecond: maximumSpeedTilesPerSecond,
		tileSizePx: Math.max(1, tileSize),
	});
	return travel.durationSeconds === 0
		? 0
		: Math.max(minimumTravelDurationMs, travel.durationSeconds * 1000);
});
