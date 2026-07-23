import type { PanInfo } from "motion/react";

export interface TileDragElasticResponse {
	readonly x: number;
	readonly y: number;
	readonly rotation: number;
}

const maximumOffsetX = 10;
const maximumOffsetY = 8;
const maximumRotation = 3;

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.max(minimum, Math.min(maximum, value));

const readAxisResponse = ({
	delta,
	velocity,
	velocityDeadZone,
	velocityFactor,
	deltaDeadZone,
	deltaFactor,
	maximum,
}: {
	readonly delta: number;
	readonly velocity: number;
	readonly velocityDeadZone: number;
	readonly velocityFactor: number;
	readonly deltaDeadZone: number;
	readonly deltaFactor: number;
	readonly maximum: number;
}) => {
	const velocityMagnitude = Math.max(0, Math.abs(velocity) - velocityDeadZone) * velocityFactor;
	const deltaMagnitude = Math.max(0, Math.abs(delta) - deltaDeadZone) * deltaFactor;
	const signedMagnitude =
		velocityMagnitude >= deltaMagnitude
			? Math.sign(velocity) * velocityMagnitude
			: Math.sign(delta) * deltaMagnitude;
	return clamp(-signedMagnitude, -maximum, maximum);
};

/**
 * Maps one pointer sample to a bounded elastic target around the authoritative
 * pointer translation. Motion owns interpolation and return-to-zero behavior.
 */
export const readTileDragElasticResponse = (
	info: Pick<PanInfo, "delta" | "velocity">,
): TileDragElasticResponse => {
	const x = readAxisResponse({
		delta: info.delta.x,
		velocity: info.velocity.x,
		velocityDeadZone: 120,
		velocityFactor: 0.006,
		deltaDeadZone: 3,
		deltaFactor: 0.35,
		maximum: maximumOffsetX,
	});
	const y = readAxisResponse({
		delta: info.delta.y,
		velocity: info.velocity.y,
		velocityDeadZone: 100,
		velocityFactor: 0.005,
		deltaDeadZone: 3,
		deltaFactor: 0.28,
		maximum: maximumOffsetY,
	});

	return {
		x,
		y,
		rotation: clamp(-x * 0.28, -maximumRotation, maximumRotation),
	};
};
