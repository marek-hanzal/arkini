import { Effect } from "effect";

import type { EditorItemOriginFlowLayoutPoint } from "~/ui/item/editor/editorItemOriginFlowLayout";

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

const sameCoordinate = (left: number, right: number) => Math.abs(left - right) <= CoordinateEpsilon;

const appendPoint = (
	points: EditorItemOriginFlowLayoutPoint[],
	point: EditorItemOriginFlowLayoutPoint,
) => {
	const previous = points.at(-1);
	if (
		previous === undefined ||
		!sameCoordinate(previous.x, point.x) ||
		!sameCoordinate(previous.y, point.y)
	)
		points.push(point);
};

const normalizeBackbone = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
): ReadonlyArray<EditorItemOriginFlowLayoutPoint> => {
	const normalized: EditorItemOriginFlowLayoutPoint[] = [];
	for (const point of points) {
		const previous = normalized.at(-1);
		if (
			previous !== undefined &&
			sameCoordinate(previous.x, point.x) &&
			sameCoordinate(previous.y, point.y)
		)
			continue;

		const beforePrevious = normalized.at(-2);
		if (beforePrevious !== undefined && previous !== undefined) {
			const vertical =
				sameCoordinate(beforePrevious.x, previous.x) && sameCoordinate(previous.x, point.x);
			const horizontal =
				sameCoordinate(beforePrevious.y, previous.y) && sameCoordinate(previous.y, point.y);
			if (vertical || horizontal) {
				normalized[normalized.length - 1] = point;
				continue;
			}
		}
		normalized.push(point);
	}
	return normalized;
};

const readSegment = (
	edgeId: string,
	index: number,
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
): MetroSegment => {
	if (sameCoordinate(from.y, to.y))
		return {
			edgeId,
			index,
			maximum: Math.max(from.x, to.x),
			minimum: Math.min(from.x, to.x),
			orientation: "horizontal",
			track: from.y,
		};
	if (sameCoordinate(from.x, to.x))
		return {
			edgeId,
			index,
			maximum: Math.max(from.y, to.y),
			minimum: Math.min(from.y, to.y),
			orientation: "vertical",
			track: from.x,
		};
	throw new Error(`Metro flow edge ${edgeId} contains a non-orthogonal segment.`);
};

const overlaps = (left: MetroSegment, right: MetroSegment) =>
	left.orientation === right.orientation &&
	sameCoordinate(left.track, right.track) &&
	Math.min(left.maximum, right.maximum) - Math.max(left.minimum, right.minimum) >
		CoordinateEpsilon;

const readLaneOffset = (
	segment: MetroSegment,
	segmentsOnTrack: ReadonlyArray<MetroSegment>,
	edgeOrder: ReadonlyMap<string, number>,
) => {
	const edgeIds = [
		...new Set(
			segmentsOnTrack
				.filter((candidate) => overlaps(segment, candidate))
				.map(({ edgeId }) => edgeId),
		),
	].sort(
		(left, right) =>
			(edgeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
				(edgeOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
	);
	if (edgeIds.length <= 1) return 0;
	const laneIndex = edgeIds.indexOf(segment.edgeId);
	if (laneIndex < 0) return 0;
	const centeredLane = laneIndex - (edgeIds.length - 1) / 2;
	const maximumLane = Math.max(1, (edgeIds.length - 1) / 2);
	const spacing = Math.min(MetroLaneSpacing, MetroMaximumHalfWidth / maximumLane);
	return centeredLane * spacing;
};

const readOffsetIntersection = (
	point: EditorItemOriginFlowLayoutPoint,
	previous: MetroSegment,
	previousOffset: number,
	next: MetroSegment,
	nextOffset: number,
): EditorItemOriginFlowLayoutPoint => {
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
	throw new Error(`Metro route contains adjacent ${previous.orientation} segments.`);
};

/** Separates highlighted bundled flow routes into stable render-only metro lanes. */
export const readEditorOriginFlowMetroBackbonesFx = Effect.fn(
	"readEditorOriginFlowMetroBackbonesFx",
)(
	(
		backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
		highlightedEdgeIds: ReadonlyArray<string>,
	) =>
		Effect.sync((): ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>> => {
			const orderedEdgeIds = [
				...new Set(highlightedEdgeIds),
			].sort((left, right) => left.localeCompare(right));
			const edgeOrder = new Map(
				orderedEdgeIds.map(
					(edgeId, index) =>
						[
							edgeId,
							index,
						] as const,
				),
			);
			const pointsByEdgeId = new Map<
				string,
				ReadonlyArray<EditorItemOriginFlowLayoutPoint>
			>();
			const segmentsByEdgeId = new Map<string, ReadonlyArray<MetroSegment>>();
			const trackGroups = new Map<string, MetroSegment[]>();

			for (const edgeId of orderedEdgeIds) {
				const backbone = backbones.get(edgeId);
				if (backbone === undefined)
					throw new Error(`Missing bundled backbone for ${edgeId}.`);
				const points = normalizeBackbone(backbone);
				pointsByEdgeId.set(edgeId, points);
				const segments: MetroSegment[] = [];
				for (let index = 1; index < points.length; index += 1) {
					const segment = readSegment(
						edgeId,
						index - 1,
						points[index - 1]!,
						points[index]!,
					);
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
						readLaneOffset(segment, segmentsOnTrack, edgeOrder),
					);
			}

			const metroBackbones = new Map<
				string,
				ReadonlyArray<EditorItemOriginFlowLayoutPoint>
			>();
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
				const metro: EditorItemOriginFlowLayoutPoint[] = [
					points[0]!,
				];
				for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1)
					appendPoint(
						metro,
						readOffsetIntersection(
							points[pointIndex]!,
							segments[pointIndex - 1]!,
							offsets[pointIndex - 1]!,
							segments[pointIndex]!,
							offsets[pointIndex]!,
						),
					);
				appendPoint(metro, points.at(-1)!);
				metroBackbones.set(edgeId, normalizeBackbone(metro));
			}
			return metroBackbones;
		}),
);
