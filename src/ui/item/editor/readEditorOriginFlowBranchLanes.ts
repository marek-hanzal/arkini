import type { EditorItemOriginEdge } from "~/bridge/item/editor/readEditorItemOriginFlow";
import type { EditorOriginFlowHighlight } from "~/ui/item/editor/readEditorOriginFlowHighlight";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";

export type EditorOriginFlowBranchLanes = ReadonlyMap<
	string,
	ReadonlyMap<number, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>
>;

const PreferredLaneSpacing = 16;
const MinimumLaneSpacing = 7;
const MaxLaneOffset = 128;
const MinimumLaneSegmentLength = 72;
const NodeClearance = 7;
const MaxCornerShift = 120;
const Epsilon = 0.01;

interface SegmentLine {
	readonly from: EditorItemOriginFlowLayoutPoint;
	readonly to: EditorItemOriginFlowLayoutPoint;
}

const distance = (left: EditorItemOriginFlowLayoutPoint, right: EditorItemOriginFlowLayoutPoint) =>
	Math.hypot(right.x - left.x, right.y - left.y);

const pointKey = ({ x, y }: EditorItemOriginFlowLayoutPoint) => `${x.toFixed(2)},${y.toFixed(2)}`;

const segmentKey = (
	left: EditorItemOriginFlowLayoutPoint,
	right: EditorItemOriginFlowLayoutPoint,
) => {
	const leftKey = pointKey(left);
	const rightKey = pointKey(right);
	return leftKey.localeCompare(rightKey) <= 0
		? `${leftKey}|${rightKey}`
		: `${rightKey}|${leftKey}`;
};

const shiftSegment = (
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
	offset: number,
): SegmentLine => {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = Math.hypot(dx, dy);
	if (length < Epsilon || Math.abs(offset) < Epsilon)
		return {
			from,
			to,
		};
	const nx = -dy / length;
	const ny = dx / length;
	return {
		from: {
			x: from.x + nx * offset,
			y: from.y + ny * offset,
		},
		to: {
			x: to.x + nx * offset,
			y: to.y + ny * offset,
		},
	};
};

const pointInsideNode = (
	point: EditorItemOriginFlowLayoutPoint,
	node: EditorItemOriginFlowLayoutNode,
) =>
	point.x > node.x - NodeClearance &&
	point.x < node.x + node.width + NodeClearance &&
	point.y > node.y - NodeClearance &&
	point.y < node.y + node.height + NodeClearance;

const orientation = (
	left: EditorItemOriginFlowLayoutPoint,
	right: EditorItemOriginFlowLayoutPoint,
	point: EditorItemOriginFlowLayoutPoint,
) => (right.x - left.x) * (point.y - left.y) - (right.y - left.y) * (point.x - left.x);

const segmentIntersectsSegment = (
	leftFrom: EditorItemOriginFlowLayoutPoint,
	leftTo: EditorItemOriginFlowLayoutPoint,
	rightFrom: EditorItemOriginFlowLayoutPoint,
	rightTo: EditorItemOriginFlowLayoutPoint,
) => {
	const a = orientation(leftFrom, leftTo, rightFrom);
	const b = orientation(leftFrom, leftTo, rightTo);
	const c = orientation(rightFrom, rightTo, leftFrom);
	const d = orientation(rightFrom, rightTo, leftTo);
	return (
		((a > Epsilon && b < -Epsilon) || (a < -Epsilon && b > Epsilon)) &&
		((c > Epsilon && d < -Epsilon) || (c < -Epsilon && d > Epsilon))
	);
};

const segmentIntersectsNode = (segment: SegmentLine, node: EditorItemOriginFlowLayoutNode) => {
	if (pointInsideNode(segment.from, node) || pointInsideNode(segment.to, node)) return true;
	const left = node.x - NodeClearance;
	const right = node.x + node.width + NodeClearance;
	const top = node.y - NodeClearance;
	const bottom = node.y + node.height + NodeClearance;
	if (
		Math.max(segment.from.x, segment.to.x) <= left ||
		Math.min(segment.from.x, segment.to.x) >= right ||
		Math.max(segment.from.y, segment.to.y) <= top ||
		Math.min(segment.from.y, segment.to.y) >= bottom
	)
		return false;
	const topLeft = {
		x: left,
		y: top,
	};
	const topRight = {
		x: right,
		y: top,
	};
	const bottomLeft = {
		x: left,
		y: bottom,
	};
	const bottomRight = {
		x: right,
		y: bottom,
	};
	return (
		segmentIntersectsSegment(segment.from, segment.to, topLeft, topRight) ||
		segmentIntersectsSegment(segment.from, segment.to, topRight, bottomRight) ||
		segmentIntersectsSegment(segment.from, segment.to, bottomRight, bottomLeft) ||
		segmentIntersectsSegment(segment.from, segment.to, bottomLeft, topLeft)
	);
};

const readCandidateOffsets = (branchCount: number) => {
	if (branchCount <= 1)
		return [
			0,
		];
	const spacing = Math.max(
		MinimumLaneSpacing,
		Math.min(PreferredLaneSpacing, (MaxLaneOffset * 2) / Math.max(1, branchCount - 1)),
	);
	const offsets = [
		0,
	];
	for (let step = 1; step * spacing <= MaxLaneOffset + Epsilon; step += 1) {
		offsets.push(step * spacing, -step * spacing);
	}
	return offsets;
};

const readSegmentLaneOffsets = (
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
	branchIndexes: ReadonlyArray<number>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const spacing = Math.max(
		MinimumLaneSpacing,
		Math.min(PreferredLaneSpacing, (MaxLaneOffset * 2) / Math.max(1, branchIndexes.length - 1)),
	);
	const offsets = new Map<number, number>();
	const used: number[] = [];
	for (const branchIndex of branchIndexes) {
		let picked: number | undefined;
		for (const candidate of readCandidateOffsets(branchIndexes.length)) {
			if (used.some((offset) => Math.abs(offset - candidate) < spacing - Epsilon)) continue;
			const shifted = shiftSegment(from, to, candidate);
			let blocked = false;
			for (const position of positions.values()) {
				if (!segmentIntersectsNode(shifted, position)) continue;
				blocked = true;
				break;
			}
			if (!blocked) {
				picked = candidate;
				break;
			}
		}
		if (picked === undefined) picked = 0;
		offsets.set(branchIndex, picked);
		used.push(picked);
	}
	return offsets;
};

const intersectLines = (left: SegmentLine, right: SegmentLine) => {
	const rx = left.to.x - left.from.x;
	const ry = left.to.y - left.from.y;
	const sx = right.to.x - right.from.x;
	const sy = right.to.y - right.from.y;
	const denominator = rx * sy - ry * sx;
	if (Math.abs(denominator) < Epsilon)
		return {
			x: (left.to.x + right.from.x) / 2,
			y: (left.to.y + right.from.y) / 2,
		};
	const qpx = right.from.x - left.from.x;
	const qpy = right.from.y - left.from.y;
	const t = (qpx * sy - qpy * sx) / denominator;
	return {
		x: left.from.x + rx * t,
		y: left.from.y + ry * t,
	};
};

const clampCorner = (
	point: EditorItemOriginFlowLayoutPoint,
	origin: EditorItemOriginFlowLayoutPoint,
) => {
	const dx = point.x - origin.x;
	const dy = point.y - origin.y;
	const length = Math.hypot(dx, dy);
	if (length <= MaxCornerShift || length < Epsilon) return point;
	const scale = MaxCornerShift / length;
	return {
		x: origin.x + dx * scale,
		y: origin.y + dy * scale,
	};
};

const readOffsetPolyline = (
	backbone: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	branchIndex: number,
	offsetsBySegment: ReadonlyMap<string, ReadonlyMap<number, number>>,
	scale: number,
) => {
	if (backbone.length < 2) return backbone;
	const shiftedSegments = backbone.slice(1).map((to, index) => {
		const from = backbone[index]!;
		const key = segmentKey(from, to);
		const laneOffset =
			index === 0 ||
			index === backbone.length - 2 ||
			distance(from, to) < MinimumLaneSegmentLength
				? 0
				: (offsetsBySegment.get(key)?.get(branchIndex) ?? 0) * scale;
		return shiftSegment(from, to, laneOffset);
	});
	const points: EditorItemOriginFlowLayoutPoint[] = [
		backbone[0]!,
	];
	for (let index = 1; index < backbone.length - 1; index += 1) {
		points.push(
			clampCorner(
				intersectLines(shiftedSegments[index - 1]!, shiftedSegments[index]!),
				backbone[index]!,
			),
		);
	}
	points.push(backbone.at(-1)!);
	return points;
};

const polylineIsClear = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	sourceNodeId: string,
	targetNodeId: string,
) => {
	for (let index = 1; index < points.length; index += 1) {
		const segment = {
			from: points[index - 1]!,
			to: points[index]!,
		};
		for (const [nodeId, position] of positions) {
			if (nodeId === sourceNodeId && index === 1) continue;
			if (nodeId === targetNodeId && index === points.length - 1) continue;
			if (segmentIntersectsNode(segment, position)) return false;
		}
	}
	return true;
};

/** Separates active Income branches inside shared safe corridor segments without rerouting the graph. */
export const readEditorOriginFlowBranchLanes = (
	edges: ReadonlyArray<EditorItemOriginEdge>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	highlight: EditorOriginFlowHighlight | undefined,
): EditorOriginFlowBranchLanes => {
	if (highlight === undefined || highlight.edgeIds.size === 0) return new Map();
	const activeEdges = edges.filter((edge) => highlight.edgeIds.has(edge.id));
	const branchIndexesBySegment = new Map<string, Set<number>>();
	const segmentGeometry = new Map<
		string,
		readonly [
			EditorItemOriginFlowLayoutPoint,
			EditorItemOriginFlowLayoutPoint,
		]
	>();
	for (const edge of activeEdges) {
		const backbone = backbones.get(edge.id);
		const branchIndexes = highlight.branchIndexesByEdgeId.get(edge.id) ?? [];
		if (backbone === undefined || branchIndexes.length === 0) continue;
		for (let index = 1; index < backbone.length; index += 1) {
			const from = backbone[index - 1]!;
			const to = backbone[index]!;
			if (
				index === 1 ||
				index === backbone.length - 1 ||
				distance(from, to) < MinimumLaneSegmentLength
			)
				continue;
			const key = segmentKey(from, to);
			segmentGeometry.set(key, [
				from,
				to,
			]);
			const indexes = branchIndexesBySegment.get(key) ?? new Set<number>();
			for (const branchIndex of branchIndexes) indexes.add(branchIndex);
			branchIndexesBySegment.set(key, indexes);
		}
	}

	const offsetsBySegment = new Map<string, ReadonlyMap<number, number>>();
	for (const [key, indexes] of branchIndexesBySegment) {
		const geometry = segmentGeometry.get(key);
		if (geometry === undefined) continue;
		offsetsBySegment.set(
			key,
			readSegmentLaneOffsets(
				geometry[0],
				geometry[1],
				[
					...indexes,
				].sort((left, right) => left - right),
				positions,
			),
		);
	}

	const lanes = new Map<
		string,
		ReadonlyMap<number, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>
	>();
	for (const edge of activeEdges) {
		const backbone = backbones.get(edge.id);
		const branchIndexes = highlight.branchIndexesByEdgeId.get(edge.id) ?? [];
		if (backbone === undefined || branchIndexes.length === 0) continue;
		const branchLanes = new Map<number, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
		for (const branchIndex of branchIndexes) {
			let points: ReadonlyArray<EditorItemOriginFlowLayoutPoint> = backbone;
			for (const scale of [
				1,
				0.75,
				0.5,
				0.25,
				0,
			] as const) {
				const candidate = readOffsetPolyline(
					backbone,
					branchIndex,
					offsetsBySegment,
					scale,
				);
				if (!polylineIsClear(candidate, positions, edge.source, edge.target)) continue;
				points = candidate;
				break;
			}
			branchLanes.set(branchIndex, points);
		}
		lanes.set(edge.id, branchLanes);
	}
	return lanes;
};
