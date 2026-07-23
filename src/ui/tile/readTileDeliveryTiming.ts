const minimumTravelDistance = 24;
const ordinaryTravelDistance = 96;
const maximumTravelDistance = 720;

const minimumTravelDuration = 0.72;
const ordinaryTravelDuration = 0.9;
const maximumTravelDuration = 1.4;

const deliveryEase = [
	0.22,
	1,
	0.36,
	1,
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.max(minimum, Math.min(maximum, value));

const interpolate = (from: number, to: number, progress: number) => from + (to - from) * progress;

export namespace readTileDeliveryTiming {
	export interface Props {
		readonly offset: {
			readonly x: number;
			readonly y: number;
		};
	}

	export interface Result {
		readonly distance: number;
		readonly travelDuration: number;
		readonly contactDelay: number;
		readonly ease: typeof deliveryEase;
	}
}

/**
 * Reads one bounded delivery clock shared by stable actors and transient payloads.
 *
 * Tiny offsets stay responsive, an ordinary one-slot trip starts near 0.9s, and
 * longer travel grows sublinearly until the 1.4s product ceiling.
 */
export const readTileDeliveryTiming = ({
	offset,
}: readTileDeliveryTiming.Props): readTileDeliveryTiming.Result => {
	const measuredDistance = Math.hypot(offset.x, offset.y);
	const distance = Number.isFinite(measuredDistance)
		? Math.max(0, measuredDistance)
		: maximumTravelDistance;
	const travelDuration =
		distance <= ordinaryTravelDistance
			? interpolate(
					minimumTravelDuration,
					ordinaryTravelDuration,
					clamp(
						(distance - minimumTravelDistance) /
							(ordinaryTravelDistance - minimumTravelDistance),
						0,
						1,
					),
				)
			: interpolate(
					ordinaryTravelDuration,
					maximumTravelDuration,
					Math.sqrt(
						clamp(
							(distance - ordinaryTravelDistance) /
								(maximumTravelDistance - ordinaryTravelDistance),
							0,
							1,
						),
					),
				);

	return {
		distance,
		travelDuration,
		contactDelay: travelDuration,
		ease: deliveryEase,
	};
};
