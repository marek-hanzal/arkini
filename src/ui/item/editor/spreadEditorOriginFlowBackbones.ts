import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";

export interface EditorItemOriginFlowBackboneEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
}

const PreferredLaneSpacing = 18;
const MinimumLaneSpacing = 11;
const MaxLaneOffset = 360;
const MinimumLaneSegmentLength = 40;
const NodeClearance = 8;
const Epsilon = 0.01;
const AxisEpsilon = 0.1;
const HubBusThreshold = 10;
const HubBusEdgesPerBus = 10;
const HubBusMaxCount = 5;
const HubBusBaseDistance = 72;
const HubBusPreferredSpacing = 24;
const HubBusMinimumSpacing = 10;
const HubBusMaxWidth = 180;
const HubBusVerticalReach = 180;

type SegmentAxis = "horizontal" | "vertical";

interface SegmentLine {
	readonly from: EditorItemOriginFlowLayoutPoint;
	readonly to: EditorItemOriginFlowLayoutPoint;
}

interface TrackSegment {
	readonly axis: SegmentAxis;
	readonly edgeId: string;
	readonly fixed: number;
	readonly index: number;
	readonly max: number;
	readonly min: number;
}

interface TrackComponent {
	readonly axis: SegmentAxis;
	readonly edgeIds: Set<string>;
	readonly fixed: number;
	max: number;
	readonly min: number;
	readonly segmentIds: string[];
}

const distance = (left: EditorItemOriginFlowLayoutPoint, right: EditorItemOriginFlowLayoutPoint) =>
	Math.hypot(right.x - left.x, right.y - left.y);

const closeCoordinate = (left: number, right: number) => Math.abs(left - right) < Epsilon;
const closeAxisCoordinate = (left: number, right: number) => Math.abs(left - right) < AxisEpsilon;

const readAxis = (
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
): SegmentAxis | undefined => {
	if (closeAxisCoordinate(from.y, to.y)) return "horizontal";
	if (closeAxisCoordinate(from.x, to.x)) return "vertical";
	return undefined;
};

const trackKey = (axis: SegmentAxis, fixed: number) => `${axis}:${fixed.toFixed(2)}`;
const segmentId = (edgeId: string, index: number) => `${edgeId}:${index}`;

const shiftSegment = (
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
	offset: number,
): SegmentLine => {
	const axis = readAxis(from, to);
	if (axis === undefined || Math.abs(offset) < Epsilon)
		return {
			from,
			to,
		};
	if (axis === "horizontal") {
		const y = (from.y + to.y) / 2 + offset;
		return {
			from: {
				x: from.x,
				y,
			},
			to: {
				x: to.x,
				y,
			},
		};
	}
	const x = (from.x + to.x) / 2 + offset;
	return {
		from: {
			x,
			y: from.y,
		},
		to: {
			x,
			y: to.y,
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

const appendDistinctPoint = (
	points: EditorItemOriginFlowLayoutPoint[],
	point: EditorItemOriginFlowLayoutPoint,
) => {
	const previous = points.at(-1);
	if (previous === undefined || Math.hypot(previous.x - point.x, previous.y - point.y) >= Epsilon)
		points.push(point);
};

const pointKey = ({ x, y }: EditorItemOriginFlowLayoutPoint) => `${x.toFixed(2)},${y.toFixed(2)}`;

const simplifyOrthogonalPoints = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	protectedPoints: ReadonlySet<string>,
) => {
	const simplified: EditorItemOriginFlowLayoutPoint[] = [];
	for (const point of points) {
		while (simplified.length >= 2) {
			const left = simplified.at(-2)!;
			const middle = simplified.at(-1)!;
			if (protectedPoints.has(pointKey(middle))) break;
			if (
				(closeCoordinate(left.x, middle.x) && closeCoordinate(middle.x, point.x)) ||
				(closeCoordinate(left.y, middle.y) && closeCoordinate(middle.y, point.y))
			)
				simplified.pop();
			else break;
		}
		appendDistinctPoint(simplified, point);
	}
	return simplified;
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

const readTrackSegments = (
	edges: ReadonlyArray<EditorItemOriginFlowBackboneEdge>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
) => {
	const tracks = new Map<string, TrackSegment[]>();
	for (const edge of edges) {
		const backbone = backbones.get(edge.id);
		if (backbone === undefined) continue;
		for (let index = 1; index < backbone.length; index += 1) {
			const from = backbone[index - 1]!;
			const to = backbone[index]!;
			const axis = readAxis(from, to);
			if (
				axis === undefined ||
				index <= 2 ||
				index >= backbone.length - 2 ||
				distance(from, to) < MinimumLaneSegmentLength
			)
				continue;
			const fixed = axis === "horizontal" ? from.y : from.x;
			const start = axis === "horizontal" ? from.x : from.y;
			const end = axis === "horizontal" ? to.x : to.y;
			const segment: TrackSegment = {
				axis,
				edgeId: edge.id,
				fixed,
				index,
				max: Math.max(start, end),
				min: Math.min(start, end),
			};
			const key = trackKey(axis, fixed);
			const track = tracks.get(key) ?? [];
			track.push(segment);
			tracks.set(key, track);
		}
	}
	return tracks;
};

const readTrackComponents = (segments: ReadonlyArray<TrackSegment>) => {
	const sorted = [
		...segments,
	].sort(
		(left, right) =>
			left.min - right.min || left.max - right.max || left.edgeId.localeCompare(right.edgeId),
	);
	const components: TrackComponent[] = [];
	for (const segment of sorted) {
		const current = components.at(-1);
		if (current === undefined || segment.min > current.max + Epsilon) {
			components.push({
				axis: segment.axis,
				edgeIds: new Set([
					segment.edgeId,
				]),
				fixed: segment.fixed,
				max: segment.max,
				min: segment.min,
				segmentIds: [
					segmentId(segment.edgeId, segment.index),
				],
			});
			continue;
		}
		current.max = Math.max(current.max, segment.max);
		current.edgeIds.add(segment.edgeId);
		current.segmentIds.push(segmentId(segment.edgeId, segment.index));
	}
	return components;
};

const readPerpendicularClearance = (
	component: TrackComponent,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	let negative = MaxLaneOffset;
	let positive = MaxLaneOffset;
	for (const node of positions.values()) {
		const left = node.x - NodeClearance;
		const right = node.x + node.width + NodeClearance;
		const top = node.y - NodeClearance;
		const bottom = node.y + node.height + NodeClearance;
		if (component.axis === "horizontal") {
			if (right <= component.min || left >= component.max) continue;
			if (component.fixed < top) positive = Math.min(positive, top - component.fixed);
			else if (component.fixed > bottom)
				negative = Math.min(negative, component.fixed - bottom);
		} else {
			if (bottom <= component.min || top >= component.max) continue;
			if (component.fixed < left) positive = Math.min(positive, left - component.fixed);
			else if (component.fixed > right)
				negative = Math.min(negative, component.fixed - right);
		}
	}
	return {
		negative: Math.max(0, negative - 1),
		positive: Math.max(0, positive - 1),
	};
};

const readComponentOffsets = (
	component: TrackComponent,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const edgeIds = [
		...component.edgeIds,
	].sort((left, right) => left.localeCompare(right));
	if (edgeIds.length <= 1)
		return new Map(
			edgeIds.map(
				(edgeId) =>
					[
						edgeId,
						0,
					] as const,
			),
		);
	const clearance = readPerpendicularClearance(component, positions);
	const available = clearance.negative + clearance.positive;
	const availableSpacing = available / Math.max(1, edgeIds.length - 1);
	const effectiveSpacing =
		availableSpacing >= MinimumLaneSpacing
			? Math.min(PreferredLaneSpacing, availableSpacing)
			: Math.max(0, availableSpacing);
	const span = effectiveSpacing * (edgeIds.length - 1);
	const minimumStart = -clearance.negative;
	const maximumStart = clearance.positive - span;
	const centeredStart = -span / 2;
	const start = Math.min(
		Math.max(centeredStart, minimumStart),
		Math.max(minimumStart, maximumStart),
	);
	return new Map(
		edgeIds.map(
			(edgeId, index) =>
				[
					edgeId,
					start + index * effectiveSpacing,
				] as const,
		),
	);
};

interface LanePlan {
	readonly offsetsBySegmentId: ReadonlyMap<string, number>;
}

const readLanePlan = (
	tracks: ReadonlyMap<string, ReadonlyArray<TrackSegment>>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
): LanePlan => {
	const offsetsBySegmentId = new Map<string, number>();
	for (const segments of tracks.values()) {
		for (const component of readTrackComponents(segments)) {
			if (component.edgeIds.size <= 1) continue;
			const offsets = readComponentOffsets(component, positions);
			for (const id of component.segmentIds) {
				const separator = id.lastIndexOf(":");
				const edgeId = id.slice(0, separator);
				offsetsBySegmentId.set(id, offsets.get(edgeId) ?? 0);
			}
		}
	}
	return {
		offsetsBySegmentId,
	};
};

const readOffsetPolyline = (
	backbone: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	edgeId: string,
	plan: LanePlan,
	scale: number,
) => {
	if (backbone.length < 2) return backbone;
	const shiftedSegments = backbone.slice(1).map((to, index) => {
		const from = backbone[index]!;
		const axis = readAxis(from, to);
		const offset =
			axis === undefined || index === 0 || index === backbone.length - 2
				? 0
				: (plan.offsetsBySegmentId.get(segmentId(edgeId, index + 1)) ?? 0) * scale;
		return {
			...shiftSegment(from, to, offset),
			axis,
		};
	});
	const points: EditorItemOriginFlowLayoutPoint[] = [
		shiftedSegments[0]!.from,
	];
	for (let index = 1; index < shiftedSegments.length; index += 1) {
		const previous = shiftedSegments[index - 1]!;
		const current = shiftedSegments[index]!;
		if (previous.axis === undefined || current.axis === undefined) {
			appendDistinctPoint(points, previous.to);
			appendDistinctPoint(points, current.from);
			continue;
		}
		if (previous.axis === current.axis) {
			appendDistinctPoint(points, previous.to);
			appendDistinctPoint(points, current.from);
			continue;
		}
		appendDistinctPoint(
			points,
			previous.axis === "horizontal"
				? {
						x: current.from.x,
						y: previous.to.y,
					}
				: {
						x: previous.to.x,
						y: current.from.y,
					},
		);
	}
	appendDistinctPoint(points, shiftedSegments.at(-1)!.to);
	const protectedPoints = new Set<string>();
	if (backbone[1] !== undefined) protectedPoints.add(pointKey(backbone[1]));
	if (backbone.at(-2) !== undefined) protectedPoints.add(pointKey(backbone.at(-2)!));
	return simplifyOrthogonalPoints(points, protectedPoints);
};

const readTerminalVerticalSegmentIndex = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	side: "source" | "target",
) => {
	if (side === "source") {
		for (let index = 2; index <= Math.min(points.length - 1, 6); index += 1)
			if (readAxis(points[index - 1]!, points[index]!) === "vertical") return index;
		return undefined;
	}
	for (let index = points.length - 2; index >= Math.max(1, points.length - 6); index -= 1)
		if (readAxis(points[index - 1]!, points[index]!) === "vertical") return index;
	return undefined;
};

const readTerminalBusRange = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	side: "source" | "target",
) => {
	const index = readTerminalVerticalSegmentIndex(points, side);
	if (index === undefined) return undefined;
	const from = points[index - 1]!;
	const to = points[index]!;
	const verticalLength = Math.abs(to.y - from.y);
	const reach = Math.min(HubBusVerticalReach, verticalLength);
	const joinY =
		side === "source"
			? from.y + (Math.sign(to.y - from.y) || 1) * reach
			: to.y + (Math.sign(from.y - to.y) || 1) * reach;
	const terminalY = side === "source" ? from.y : to.y;
	return {
		max: Math.max(terminalY, joinY),
		min: Math.min(terminalY, joinY),
	};
};

const readBusSideClearance = (
	nodeId: string,
	position: EditorItemOriginFlowLayoutNode,
	side: "left" | "right",
	yMin: number,
	yMax: number,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const borderX = side === "left" ? position.x : position.x + position.width;
	let clearance = HubBusBaseDistance + HubBusMaxWidth + NodeClearance;
	for (const [otherId, other] of positions) {
		if (otherId === nodeId) continue;
		const otherTop = other.y - NodeClearance;
		const otherBottom = other.y + other.height + NodeClearance;
		if (otherBottom <= yMin || otherTop >= yMax) continue;
		if (side === "left") {
			const otherRight = other.x + other.width + NodeClearance;
			if (otherRight > borderX) continue;
			clearance = Math.min(clearance, borderX - otherRight);
		} else {
			const otherLeft = other.x - NodeClearance;
			if (otherLeft < borderX) continue;
			clearance = Math.min(clearance, otherLeft - borderX);
		}
	}
	return Math.max(0, clearance);
};

const routeTerminalViaBus = (
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	side: "source" | "target",
	busX: number,
) => {
	const index = readTerminalVerticalSegmentIndex(points, side);
	if (index === undefined) return points;
	const from = points[index - 1]!;
	const to = points[index]!;
	if (Math.abs(from.x - busX) < Epsilon) return points;
	const verticalLength = Math.abs(to.y - from.y);
	const reach = Math.min(HubBusVerticalReach, verticalLength);
	const candidate: EditorItemOriginFlowLayoutPoint[] = [];
	for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
		const point = points[pointIndex]!;
		appendDistinctPoint(candidate, point);
		if (pointIndex !== index - 1) continue;
		if (side === "source") {
			const direction = Math.sign(to.y - from.y) || 1;
			const joinY = from.y + direction * reach;
			appendDistinctPoint(candidate, {
				x: busX,
				y: from.y,
			});
			appendDistinctPoint(candidate, {
				x: busX,
				y: joinY,
			});
			appendDistinctPoint(candidate, {
				x: from.x,
				y: joinY,
			});
		} else {
			const direction = Math.sign(from.y - to.y) || 1;
			const joinY = to.y + direction * reach;
			appendDistinctPoint(candidate, {
				x: from.x,
				y: joinY,
			});
			appendDistinctPoint(candidate, {
				x: busX,
				y: joinY,
			});
			appendDistinctPoint(candidate, {
				x: busX,
				y: to.y,
			});
		}
	}
	const protectedPoints = new Set<string>();
	if (candidate[1] !== undefined) protectedPoints.add(pointKey(candidate[1]));
	if (candidate.at(-2) !== undefined) protectedPoints.add(pointKey(candidate.at(-2)!));
	return simplifyOrthogonalPoints(candidate, protectedPoints);
};

/** Collapses dense multi-port fanout into a bounded set of local terminal buses. */
const bundleHubTerminals = (
	edges: ReadonlyArray<EditorItemOriginFlowBackboneEdge>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const edgeById = new Map(
		edges.map(
			(edge) =>
				[
					edge.id,
					edge,
				] as const,
		),
	);
	const groups = new Map<
		string,
		{
			nodeId: string;
			side: "left" | "right";
			edgeIds: string[];
		}
	>();
	for (const edge of edges) {
		for (const [nodeId, side] of [
			[
				edge.source,
				"right",
			],
			[
				edge.target,
				"left",
			],
		] as const) {
			const key = `${nodeId}:${side}`;
			const group = groups.get(key) ?? {
				nodeId,
				side,
				edgeIds: [],
			};
			group.edgeIds.push(edge.id);
			groups.set(key, group);
		}
	}
	const result = new Map(backbones);
	for (const group of groups.values()) {
		if (group.edgeIds.length < HubBusThreshold) continue;
		const position = positions.get(group.nodeId);
		if (position === undefined) continue;
		const terminalSide = group.side === "left" ? "target" : "source";
		const sorted = group.edgeIds
			.map((edgeId) => {
				const points = result.get(edgeId);
				if (points === undefined) return undefined;
				const range = readTerminalBusRange(points, terminalSide);
				if (range === undefined) return undefined;
				return {
					edgeId,
					portY: group.side === "left" ? points.at(-1)!.y : points[0]!.y,
					range,
				};
			})
			.filter(
				(
					entry,
				): entry is {
					edgeId: string;
					portY: number;
					range: {
						readonly max: number;
						readonly min: number;
					};
				} => entry !== undefined,
			)
			.sort(
				(left, right) =>
					left.portY - right.portY || left.edgeId.localeCompare(right.edgeId),
			);
		const busCount = Math.min(HubBusMaxCount, Math.ceil(sorted.length / HubBusEdgesPerBus));
		if (busCount === 0) continue;
		const busGroups = Array.from(
			{
				length: busCount,
			},
			() => [] as typeof sorted,
		);
		for (const [index, entry] of sorted.entries()) {
			const busIndex = Math.min(busCount - 1, Math.floor((index * busCount) / sorted.length));
			busGroups[busIndex]!.push(entry);
		}
		const busDistances = busGroups.map((entries, busIndex) => {
			const yMin = Math.min(...entries.map(({ range }) => range.min));
			const yMax = Math.max(...entries.map(({ range }) => range.max));
			const clearance = readBusSideClearance(
				group.nodeId,
				position,
				group.side,
				yMin,
				yMax,
				positions,
			);
			const desired = HubBusBaseDistance + busIndex * HubBusPreferredSpacing;
			const maximum = Math.max(0, clearance - NodeClearance);
			return Math.min(desired, HubBusBaseDistance + HubBusMaxWidth, maximum);
		});
		for (const [busIndex, entries] of busGroups.entries()) {
			const busDistance = busDistances[busIndex]!;
			if (busDistance < HubBusMinimumSpacing) continue;
			const busX =
				group.side === "left"
					? position.x - busDistance
					: position.x + position.width + busDistance;
			for (const entry of entries) {
				const current = result.get(entry.edgeId);
				const edge = edgeById.get(entry.edgeId);
				if (current === undefined || edge === undefined) continue;
				for (const scale of [
					1,
					0.75,
					0.5,
					0.25,
					0,
				] as const) {
					const terminalIndex = readTerminalVerticalSegmentIndex(current, terminalSide);
					if (terminalIndex === undefined) break;
					const originalX = current[terminalIndex - 1]!.x;
					const x = originalX + (busX - originalX) * scale;
					const candidate = routeTerminalViaBus(current, terminalSide, x);
					if (!polylineIsClear(candidate, positions, edge.source, edge.target)) continue;
					result.set(entry.edgeId, candidate);
					break;
				}
			}
		}
	}
	return result;
};

/** Gives every physical edge one stable lane through each overlapping orthogonal corridor. */
export const spreadEditorOriginFlowBackbones = (
	edges: ReadonlyArray<EditorItemOriginFlowBackboneEdge>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const plan = readLanePlan(readTrackSegments(edges, backbones), positions);
	const spread = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	for (const edge of [
		...edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const backbone = backbones.get(edge.id);
		if (backbone === undefined) continue;
		let points: ReadonlyArray<EditorItemOriginFlowLayoutPoint> = backbone;
		for (const scale of [
			1,
			0.85,
			0.7,
			0.55,
			0.4,
			0.25,
			0,
		] as const) {
			const candidate = readOffsetPolyline(backbone, edge.id, plan, scale);
			if (!polylineIsClear(candidate, positions, edge.source, edge.target)) continue;
			points = candidate;
			break;
		}
		spread.set(edge.id, points);
	}
	return bundleHubTerminals(edges, spread, positions);
};
