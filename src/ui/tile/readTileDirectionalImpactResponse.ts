export namespace readTileDirectionalImpactResponse {
	export interface Vector {
		readonly x: number;
		readonly y: number;
	}

	export interface Result {
		readonly primaryAxis: "x" | "y" | null;
		readonly scaleX: number;
		readonly scaleY: number;
		readonly rotation: number;
	}
}

const primaryCompression = 0.9;
const orthogonalCompensation = 1.06;
const maximumRotation = 2.4;
const minimumDirectionLength = 0.001;

/**
 * Resolves the target body's first contact pose from the committed
 * origin-to-target vector. Animation timing and interpolation stay Motion-owned.
 */
export const readTileDirectionalImpactResponse = ({
	originToTarget,
}: {
	readonly originToTarget: readTileDirectionalImpactResponse.Vector;
}): readTileDirectionalImpactResponse.Result => {
	const length = Math.hypot(originToTarget.x, originToTarget.y);
	if (!Number.isFinite(length) || length < minimumDirectionLength) {
		return {
			primaryAxis: null,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
		};
	}

	const direction = {
		x: originToTarget.x / length,
		y: originToTarget.y / length,
	};
	const primaryAxis = Math.abs(direction.x) >= Math.abs(direction.y) ? "x" : "y";

	return {
		primaryAxis,
		scaleX: primaryAxis === "x" ? primaryCompression : orthogonalCompensation,
		scaleY: primaryAxis === "y" ? primaryCompression : orthogonalCompensation,
		rotation:
			primaryAxis === "x" ? -direction.x * maximumRotation : direction.y * maximumRotation,
	};
};
