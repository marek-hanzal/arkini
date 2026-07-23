export namespace readTileProducerEmissionResponse {
	export interface Vector {
		readonly x: number;
		readonly y: number;
	}

	export interface Result {
		readonly direction: Vector;
		readonly anticipation: {
			readonly primaryAxis: "x" | "y";
			readonly scaleX: number;
			readonly scaleY: number;
		};
		readonly recoil: Vector;
		readonly hop: Vector;
	}
}

const anticipationCompression = 0.9;
const anticipationCompensation = 1.06;
const recoilDistance = 6;
const hopDistance = 4;
const minimumDirectionLength = 0.001;

const readEmissionDirection = (
	originToTarget: readTileProducerEmissionResponse.Vector,
): readTileProducerEmissionResponse.Vector => {
	const length = Math.hypot(originToTarget.x, originToTarget.y);
	if (!Number.isFinite(length) || length < minimumDirectionLength) {
		return {
			x: 0,
			y: -1,
		};
	}
	return {
		x: originToTarget.x / length,
		y: originToTarget.y / length,
	};
};

/**
 * Resolves one producer's direction-aware anticipation and release offsets.
 * A missing spatial direction degrades to the shared neutral upward gesture.
 */
export const readTileProducerEmissionResponse = ({
	originToTarget,
}: {
	readonly originToTarget: readTileProducerEmissionResponse.Vector;
}): readTileProducerEmissionResponse.Result => {
	const direction = readEmissionDirection(originToTarget);
	const primaryAxis = Math.abs(direction.x) >= Math.abs(direction.y) ? "x" : "y";

	return {
		direction,
		anticipation: {
			primaryAxis,
			scaleX: primaryAxis === "x" ? anticipationCompression : anticipationCompensation,
			scaleY: primaryAxis === "y" ? anticipationCompression : anticipationCompensation,
		},
		recoil: {
			x: -direction.x * recoilDistance,
			y: -direction.y * recoilDistance,
		},
		hop: {
			x: direction.x * hopDistance,
			y: direction.y * hopDistance,
		},
	};
};
