import { Effect } from "effect";

export namespace readTileTravelDurationFx {
	export interface Props {
		readonly distancePx: number;
		readonly tileSizePx: number;
		readonly maxSpeedTilesPerSecond: number;
		readonly maxAccelerationTilesPerSecondSquared: number;
	}

	export interface Result {
		readonly durationSeconds: number;
		readonly limitingConstraint: "acceleration" | "settled" | "speed";
		readonly maxAccelerationPxPerSecondSquared: number;
		readonly maxSpeedPxPerSecond: number;
		readonly peakAccelerationPxPerSecondSquared: number;
		readonly peakSpeedPxPerSecond: number;
	}
}

const smoothstepPeakSpeedFactor = 1.5;
const smoothstepPeakAccelerationFactor = 6;

/**
 * Derives travel duration from physical limits for `3u² - 2u³`.
 *
 * The profile starts and ends at zero velocity. Its peak speed is `1.5D/T`
 * and its peak acceleration magnitude is `6D/T²`.
 */
export const readTileTravelDurationFx = Effect.fn("readTileTravelDurationFx")(
	({
		distancePx,
		tileSizePx,
		maxSpeedTilesPerSecond,
		maxAccelerationTilesPerSecondSquared,
	}: readTileTravelDurationFx.Props) =>
		Effect.sync((): readTileTravelDurationFx.Result => {
			const maxSpeedPxPerSecond = maxSpeedTilesPerSecond * tileSizePx;
			const maxAccelerationPxPerSecondSquared =
				maxAccelerationTilesPerSecondSquared * tileSizePx;
			if (distancePx === 0) {
				return {
					durationSeconds: 0,
					limitingConstraint: "settled",
					maxAccelerationPxPerSecondSquared,
					maxSpeedPxPerSecond,
					peakAccelerationPxPerSecondSquared: 0,
					peakSpeedPxPerSecond: 0,
				};
			}

			const speedBoundDurationSeconds =
				(smoothstepPeakSpeedFactor * distancePx) / maxSpeedPxPerSecond;
			const accelerationBoundDurationSeconds = Math.sqrt(
				(smoothstepPeakAccelerationFactor * distancePx) / maxAccelerationPxPerSecondSquared,
			);
			const speedLimited = speedBoundDurationSeconds >= accelerationBoundDurationSeconds;
			const durationSeconds = speedLimited
				? speedBoundDurationSeconds
				: accelerationBoundDurationSeconds;

			return {
				durationSeconds,
				limitingConstraint: speedLimited ? "speed" : "acceleration",
				maxAccelerationPxPerSecondSquared,
				maxSpeedPxPerSecond,
				peakAccelerationPxPerSecondSquared:
					(smoothstepPeakAccelerationFactor * distancePx) / durationSeconds ** 2,
				peakSpeedPxPerSecond: (smoothstepPeakSpeedFactor * distancePx) / durationSeconds,
			};
		}),
);
