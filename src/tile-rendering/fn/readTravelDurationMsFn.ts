export namespace readTravelDurationMsFn {
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
const smoothstepPeakSpeedFactor = 1.5;
const smoothstepPeakAccelerationFactor = 6;

/**
 * Derives a distance-sensitive duration for `3u² - 2u³` travel.
 * Its peak speed is `1.5D/T` and peak acceleration magnitude is `6D/T²`.
 */
export const readTravelDurationMsFn = ({
	fromX,
	fromY,
	tileSize,
	toX,
	toY,
}: readTravelDurationMsFn.Props): number => {
	const distancePx = Math.hypot(toX - fromX, toY - fromY);
	if (distancePx === 0) return 0;

	const tileSizePx = Math.max(1, tileSize);
	const maximumSpeedPxPerSecond = maximumSpeedTilesPerSecond * tileSizePx;
	const maximumAccelerationPxPerSecondSquared =
		maximumAccelerationTilesPerSecondSquared * tileSizePx;
	const speedBoundDurationSeconds =
		(smoothstepPeakSpeedFactor * distancePx) / maximumSpeedPxPerSecond;
	const accelerationBoundDurationSeconds = Math.sqrt(
		(smoothstepPeakAccelerationFactor * distancePx) / maximumAccelerationPxPerSecondSquared,
	);
	const durationSeconds = Math.max(speedBoundDurationSeconds, accelerationBoundDurationSeconds);

	return Math.max(minimumTravelDurationMs, durationSeconds * 1000);
};
