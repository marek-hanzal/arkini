export namespace sampleTilePaintingDabsFn {
	export interface Point {
		readonly x: number;
		readonly y: number;
	}

	export interface Props {
		readonly from: Point;
		readonly to: Point;
		readonly spacing: number;
		readonly distanceToNext: number;
	}

	export interface Output {
		readonly points: ReadonlyArray<Point>;
		readonly distanceToNext: number;
	}
}

/** Carry the unconsumed distance across events so event frequency cannot change paint density. */
export const sampleTilePaintingDabsFn = ({
	from,
	to,
	spacing,
	distanceToNext,
}: sampleTilePaintingDabsFn.Props): sampleTilePaintingDabsFn.Output => {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	if (!Number.isFinite(length) || length === 0 || !Number.isFinite(spacing) || spacing <= 0) {
		return {
			points: [],
			distanceToNext,
		};
	}
	const points: Array<sampleTilePaintingDabsFn.Point> = [];
	let distance = Number.isFinite(distanceToNext) && distanceToNext > 0 ? distanceToNext : spacing;
	for (; distance <= length + 1e-8; distance += spacing) {
		const ratio = Math.min(1, distance / length);
		points.push({
			x: from.x + (to.x - from.x) * ratio,
			y: from.y + (to.y - from.y) * ratio,
		});
	}
	return {
		points,
		distanceToNext: distance - length,
	};
};
