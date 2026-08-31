import { Order } from "effect";

import type { LayoutPoint } from "~/flow-layout/type/Layout";

const MetroLaneSpacing = 10;
const MetroMaximumHalfWidth = 42;
const CoordinateEpsilon = 0.01;

interface MetroSegment {
	readonly edgeId: string;
	readonly index: number;
	readonly maximum: number;
	readonly minimum: number;
	readonly orientation: "horizontal" | "vertical";
	readonly track: number;
}

type MetroBackbonesResult =
	| {
			readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
			readonly ok: true;
	  }
	| {
			readonly message: string;
			readonly ok: false;
	  };

const sameCoordinateFn = (left: number, right: number) =>
	Math.abs(left - right) <= CoordinateEpsilon;

const appendPointFn = (points: LayoutPoint[], point: LayoutPoint) => {
	const previous = points.at(-1);
	if (
		previous === undefined ||
		!sameCoordinateFn(previous.x, point.x) ||
		!sameCoordinateFn(previous.y, point.y)
	)
		points.push(point);
};

const normalizeBackboneFn = (points: ReadonlyArray<LayoutPoint>): ReadonlyArray<LayoutPoint> => {
	const normalized: LayoutPoint[] = [];
	for (const point of points) {
		const previous = normalized.at(-1);
		if (
			previous !== undefined &&
			sameCoordinateFn(previous.x, point.x) &&
			sameCoordinateFn(previous.y, point.y)
		)
			continue;

		const beforePrevious = normalized.at(-2);
		if (beforePrevious !== undefined && previous !== undefined) {
			const vertical =
				sameCoordinateFn(beforePrevious.x, previous.x) &&
				sameCoordinateFn(previous.x, point.x);
			const horizontal =
				sameCoordinateFn(beforePrevious.y, previous.y) &&
				sameCoordinateFn(previous.y, point.y);
			if (vertical || horizontal) {
				normalized[normalized.length - 1] = point;
				continue;
			}
		}
		normalized.push(point);
	}
	return normalized;
};

const readSegmentFn = (
	edgeId: string,
	index: number,
	from: LayoutPoint,
	to: LayoutPoint,
): MetroSegment | undefined => {
	if (sameCoordinateFn(from.y, to.y))
		return {
			edgeId,
			index,
			maximum: Math.max(from.x, to.x),
			minimum: Math.min(from.x, to.x),
			orientation: "horizontal",
			track: from.y,
		};
	if (sameCoordinateFn(from.x, to.x))
		return {
			edgeId,
			index,
			maximum: Math.max(from.y, to.y),
			minimum: Math.min(from.y, to.y),
			orientation: "vertical",
			track: from.x,
		};
	return undefined;
};

const overlapsFn = (left: MetroSegment, right: MetroSegment) =>
	left.orientation === right.orientation &&
	sameCoordinateFn(left.track, right.track) &&
	Math.min(left.maximum, right.maximum) - Math.max(left.minimum, right.minimum) >
		CoordinateEpsilon;

const readLaneOffsetFn = (
	segment: MetroSegment,
	segmentsOnTrack: ReadonlyArray<MetroSegment>,
	edgeOrder: ReadonlyMap<string, number>,
) => {
	const edgeIds = [
		...new Set(
			segmentsOnTrack
				.filter((candidate) => overlapsFn(segment, candidate))
				.map(({ edgeId }) => edgeId),
		),
	].sort(
		(left, right) =>
			(edgeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
				(edgeOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || Order.String(left, right),
	);
	if (edgeIds.length <= 1) return 0;
	const laneIndex = edgeIds.indexOf(segment.edgeId);
	if (laneIndex < 0) return 0;
	const centeredLane = laneIndex - (edgeIds.length - 1) / 2;
	const maximumLane = Math.max(1, (edgeIds.length - 1) / 2);
	const spacing = Math.min(MetroLaneSpacing, MetroMaximumHalfWidth / maximumLane);
	return centeredLane * spacing;
};

const readOffsetIntersectionFn = (
	point: LayoutPoint,
	previous: MetroSegment,
	previousOffset: number,
	next: MetroSegment,
	nextOffset: number,
): LayoutPoint | undefined => {
	if (previous.orientation === "horizontal" && next.orientation === "vertical")
		return {
			x: point.x + nextOffset,
			y: point.y + previousOffset,
		};
	if (previous.orientation === "vertical" && next.orientation === "horizontal")
		return {
			x: point.x + previousOffset,
			y: point.y + nextOffset,
		};
	return undefined;
};

/** Separates highlighted bundled flow routes into stable render-only metro lanes. */
export const readMetroBackbonesFn = (
	backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>,
	highlightedEdgeIds: ReadonlyArray<string>,
): MetroBackbonesResult => {
	const orderedEdgeIds = [
		...new Set(highlightedEdgeIds),
	].sort(Order.String);
	const edgeOrder = new Map(
		orderedEdgeIds.map(
			(edgeId, index) =>
				[
					edgeId,
					index,
				] as const,
		),
	);
	const pointsByEdgeId = new Map<string, ReadonlyArray<LayoutPoint>>();
	const segmentsByEdgeId = new Map<string, ReadonlyArray<MetroSegment>>();
	const trackGroups = new Map<string, MetroSegment[]>();

	for (const edgeId of orderedEdgeIds) {
		const backbone = backbones.get(edgeId);
		if (backbone === undefined)
			return {
				message: `Missing bundled backbone for ${edgeId}.`,
				ok: false,
			};
		const points = normalizeBackboneFn(backbone);
		pointsByEdgeId.set(edgeId, points);
		const segments: MetroSegment[] = [];
		for (let index = 1; index < points.length; index += 1) {
			const segment = readSegmentFn(edgeId, index - 1, points[index - 1]!, points[index]!);
			if (segment === undefined)
				return {
					message: `Metro flow edge ${edgeId} contains a non-orthogonal segment.`,
					ok: false,
				};
			segments.push(segment);
			const key = `${segment.orientation}:${segment.track.toFixed(4)}`;
			const group = trackGroups.get(key) ?? [];
			group.push(segment);
			trackGroups.set(key, group);
		}
		segmentsByEdgeId.set(edgeId, segments);
	}

	const laneOffsetBySegment = new Map<string, number>();
	for (const segmentsOnTrack of trackGroups.values()) {
		for (const segment of segmentsOnTrack)
			laneOffsetBySegment.set(
				`${segment.edgeId}:${segment.index}`,
				readLaneOffsetFn(segment, segmentsOnTrack, edgeOrder),
			);
	}

	const metroBackbones = new Map<string, ReadonlyArray<LayoutPoint>>();
	for (const edgeId of orderedEdgeIds) {
		const points = pointsByEdgeId.get(edgeId)!;
		const segments = segmentsByEdgeId.get(edgeId)!;
		if (segments.length <= 1) {
			metroBackbones.set(edgeId, points);
			continue;
		}

		const offsets = segments.map((segment, index) =>
			index === 0 || index === segments.length - 1
				? 0
				: (laneOffsetBySegment.get(`${edgeId}:${segment.index}`) ?? 0),
		);
		const metro: LayoutPoint[] = [
			points[0]!,
		];
		for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
			const intersection = readOffsetIntersectionFn(
				points[pointIndex]!,
				segments[pointIndex - 1]!,
				offsets[pointIndex - 1]!,
				segments[pointIndex]!,
				offsets[pointIndex]!,
			);
			if (intersection === undefined)
				return {
					message: `Metro route contains adjacent ${segments[pointIndex - 1]!.orientation} segments.`,
					ok: false,
				};
			appendPointFn(metro, intersection);
		}
		appendPointFn(metro, points.at(-1)!);
		metroBackbones.set(edgeId, normalizeBackboneFn(metro));
	}
	return {
		backbones: metroBackbones,
		ok: true,
	};
};
