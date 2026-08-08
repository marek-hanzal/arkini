import {
	BezierSeg,
	Cdt,
	findContainingTriangle,
	funnelFromDiagonals,
	Curve,
	CurveFactory,
	Edge,
	EdgeRoutingMode,
	FastIncrementalLayoutSettings,
	GeomEdge,
	GeomGraph,
	GeomNode,
	Graph,
	InteractiveObstacleCalculator,
	Node,
	Point,
	Polyline,
	Rectangle,
	RelativeFloatingPort,
	sleeveToDiagonals,
	layoutGeomGraph,
} from "@msagl/core";
import { Effect } from "effect";

export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly id: string;
		readonly source: string;
		readonly sourcePortId?: string;
		readonly target: string;
		readonly targetPortId?: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly height: number;
		readonly id: string;
		readonly ports: ReadonlyArray<{
			readonly id: string;
			readonly x: number;
			readonly y: number;
		}>;
		readonly width: number;
	}>;
}

export interface EditorItemOriginFlowLayoutNode {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayoutPoint {
	readonly x: number;
	readonly y: number;
}

export type EditorItemOriginFlowLayoutRouteSegment =
	| {
			readonly from: EditorItemOriginFlowLayoutPoint;
			readonly kind: "line";
			readonly to: EditorItemOriginFlowLayoutPoint;
	  }
	| {
			readonly control1: EditorItemOriginFlowLayoutPoint;
			readonly control2: EditorItemOriginFlowLayoutPoint;
			readonly from: EditorItemOriginFlowLayoutPoint;
			readonly kind: "cubic";
			readonly to: EditorItemOriginFlowLayoutPoint;
	  };

export interface EditorItemOriginFlowLayout {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>>;
}

const NodeSeparation = 144;
const PackingAspectRatio = 1.6;
const EdgePadding = 40;
const PortEscape = EdgePadding + 16;
const CorridorCongestionBasePenalty = 84;
const CorridorCongestionLengthFactor = 0.18;
const CorridorCongestionCap = 12;
const OrthogonalSafetyPadding = 10;
const OrthogonalEpsilon = 0.1;

type CorridorTriangle = NonNullable<ReturnType<typeof findContainingTriangle>>;
type CorridorEdge = ReturnType<CorridorTriangle["Edges"]["getItem"]>;

interface WeightedGraph {
	readonly incoming: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

const addWeight = (map: Map<string, number>, id: string) => {
	map.set(id, (map.get(id) ?? 0) + 1);
};

const readWeightedGraph = (flow: EditorItemOriginFlowLayoutInput): WeightedGraph => {
	const incoming = new Map<string, Map<string, number>>();
	const outgoing = new Map<string, Map<string, number>>();
	for (const { id } of flow.nodes) {
		incoming.set(id, new Map());
		outgoing.set(id, new Map());
	}
	for (const { source, target } of flow.edges) {
		const sourceOutgoing = outgoing.get(source);
		const targetIncoming = incoming.get(target);
		if (sourceOutgoing === undefined || targetIncoming === undefined)
			throw new Error(`Flow edge references an unknown node: ${source} -> ${target}.`);
		addWeight(sourceOutgoing, target);
		addWeight(targetIncoming, source);
	}
	return {
		incoming,
		outgoing,
	};
};

const sumWeights = (entries: ReadonlyMap<string, number>) => {
	let total = 0;
	for (const weight of entries.values()) total += weight;
	return total;
};

/** Keeps feedback edges explicit while giving highlight traversal one stable forward order. */
const readFlowOrder = (
	flow: EditorItemOriginFlowLayoutInput,
	graph: WeightedGraph,
): ReadonlyMap<string, number> => {
	const nodeIds = flow.nodes.map(({ id }) => id).sort((left, right) => left.localeCompare(right));
	const active = new Set(nodeIds);
	const inDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeights(graph.incoming.get(id) ?? new Map()),
		]),
	);
	const outDegree = new Map(
		nodeIds.map((id) => [
			id,
			sumWeights(graph.outgoing.get(id) ?? new Map()),
		]),
	);
	const left: string[] = [];
	const right: string[] = [];

	const remove = (id: string, side: "left" | "right") => {
		active.delete(id);
		(side === "left" ? left : right).push(id);
		for (const [target, weight] of graph.outgoing.get(id) ?? []) {
			if (!active.has(target)) continue;
			inDegree.set(target, (inDegree.get(target) ?? 0) - weight);
		}
		for (const [source, weight] of graph.incoming.get(id) ?? []) {
			if (!active.has(source)) continue;
			outDegree.set(source, (outDegree.get(source) ?? 0) - weight);
		}
	};

	while (active.size > 0) {
		let removedTerminal = true;
		while (removedTerminal && active.size > 0) {
			removedTerminal = false;
			const sinks = [
				...active,
			]
				.filter((id) => (outDegree.get(id) ?? 0) === 0)
				.sort((leftId, rightId) => leftId.localeCompare(rightId));
			for (const id of sinks) {
				if (!active.has(id)) continue;
				remove(id, "right");
				removedTerminal = true;
			}
			const sources = [
				...active,
			]
				.filter((id) => (inDegree.get(id) ?? 0) === 0)
				.sort((leftId, rightId) => leftId.localeCompare(rightId));
			for (const id of sources) {
				if (!active.has(id)) continue;
				remove(id, "left");
				removedTerminal = true;
			}
		}
		if (active.size === 0) break;

		let bestId: string | undefined;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (const id of active) {
			const score = (outDegree.get(id) ?? 0) - (inDegree.get(id) ?? 0);
			if (
				score > bestScore ||
				(score === bestScore && (bestId === undefined || id.localeCompare(bestId) < 0))
			) {
				bestId = id;
				bestScore = score;
			}
		}
		if (bestId === undefined) throw new Error("Could not order the flow graph.");
		remove(bestId, "left");
	}

	const ordered = [
		...left,
		...right.reverse(),
	];
	return new Map(
		ordered.map((id, index) => [
			id,
			index,
		]),
	);
};

const toLayoutPoint = ({ x, y }: Point): EditorItemOriginFlowLayoutPoint => ({
	x,
	y,
});

const SplineSafetyPadding = 8;
const SplineTensions = [
	1,
	0.82,
	0.64,
	0.46,
	0.28,
] as const;

const readLineSegment = (from: Point, to: Point): EditorItemOriginFlowLayoutRouteSegment => ({
	from: toLayoutPoint(from),
	kind: "line",
	to: toLayoutPoint(to),
});

const distance = (left: Point, right: Point) => Math.hypot(right.x - left.x, right.y - left.y);

const normalize = (vector: Point) => {
	const length = Math.hypot(vector.x, vector.y);
	return length < 0.001 ? new Point(1, 0) : new Point(vector.x / length, vector.y / length);
};

const readSplineTangent = (
	points: ReadonlyArray<Point>,
	index: number,
	startDirection: Point,
	endDirection: Point,
) => {
	if (index === 0) return startDirection;
	if (index === points.length - 1) return endDirection;
	const previous = points[index - 1] as Point;
	const next = points[index + 1] as Point;
	return normalize(next.sub(previous));
};

const readSplineSegments = (
	points: ReadonlyArray<Point>,
	startDirection: Point,
	endDirection: Point,
	tension: number,
): EditorItemOriginFlowLayoutRouteSegment[] => {
	if (points.length < 2) return [];
	const tangents = points.map((_, index) =>
		readSplineTangent(points, index, startDirection, endDirection),
	);
	const segments: EditorItemOriginFlowLayoutRouteSegment[] = [];
	for (let index = 0; index < points.length - 1; index += 1) {
		const from = points[index] as Point;
		const to = points[index + 1] as Point;
		const chord = distance(from, to);
		if (chord < 0.01) continue;
		const neighboringDistance = Math.min(
			distance(points[Math.max(0, index - 1)] as Point, to),
			distance(from, points[Math.min(points.length - 1, index + 2)] as Point),
		);
		const controlDistance =
			Math.min(260, Math.max(28, Math.min(chord * 0.48, neighboringDistance * 0.32))) *
			tension;
		const control1 = from.add((tangents[index] as Point).mul(controlDistance));
		const control2 = to.sub((tangents[index + 1] as Point).mul(controlDistance));
		segments.push({
			control1: toLayoutPoint(control1),
			control2: toLayoutPoint(control2),
			from: toLayoutPoint(from),
			kind: "cubic",
			to: toLayoutPoint(to),
		});
	}
	return segments;
};

const splineIsClear = (
	segments: ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>,
	obstacles: ReadonlyArray<Rectangle>,
) => {
	for (const segment of segments) {
		if (segment.kind !== "cubic") continue;
		const bezier = new BezierSeg(
			new Point(segment.from.x, segment.from.y),
			new Point(segment.control1.x, segment.control1.y),
			new Point(segment.control2.x, segment.control2.y),
			new Point(segment.to.x, segment.to.y),
		);
		for (const obstacle of obstacles) {
			const padded = obstacle.clone();
			padded.pad(SplineSafetyPadding);
			if (!padded.intersects(bezier.boundingBox)) continue;
			if (padded.contains(bezier.start) || padded.contains(bezier.end)) return false;
			if (Curve.getAllIntersections(bezier, padded.perimeter(), false).length > 0)
				return false;
		}
	}
	return true;
};

const readDirectSpline = (
	from: Point,
	to: Point,
	startDirection: Point,
	endDirection: Point,
	tension: number,
): EditorItemOriginFlowLayoutRouteSegment[] => {
	const chord = distance(from, to);
	if (chord < 0.01) return [];
	const controlDistance = Math.min(420, Math.max(80, chord * 0.46)) * tension;
	return [
		{
			control1: toLayoutPoint(from.add(startDirection.mul(controlDistance))),
			control2: toLayoutPoint(to.sub(endDirection.mul(controlDistance))),
			from: toLayoutPoint(from),
			kind: "cubic",
			to: toLayoutPoint(to),
		},
	];
};

const smoothRoute = (
	points: ReadonlyArray<Point>,
	startDirection: Point,
	endDirection: Point,
	obstacles: ReadonlyArray<Rectangle>,
): EditorItemOriginFlowLayoutRouteSegment[] => {
	if (points.length >= 2) {
		const from = points[0] as Point;
		const to = points[points.length - 1] as Point;
		for (const tension of SplineTensions) {
			const direct = readDirectSpline(from, to, startDirection, endDirection, tension);
			if (splineIsClear(direct, obstacles)) return direct;
		}
	}
	for (const tension of SplineTensions) {
		const spline = readSplineSegments(points, startDirection, endDirection, tension);
		if (splineIsClear(spline, obstacles)) return spline;
	}
	return points.slice(1).map((point, index) => readLineSegment(points[index] as Point, point));
};

const pointClose = (left: Point, right: Point) =>
	Math.hypot(left.x - right.x, left.y - right.y) < 0.01;

const appendDistinctPoint = (points: Point[], point: Point) => {
	if (points.length === 0 || !pointClose(points[points.length - 1] as Point, point))
		points.push(point);
};

const closeCoordinate = (left: number, right: number) => Math.abs(left - right) < OrthogonalEpsilon;

const axisSegmentIntersectsRectangle = (from: Point, to: Point, rectangle: Rectangle) => {
	const padded = rectangle.clone();
	padded.pad(OrthogonalSafetyPadding);
	if (closeCoordinate(from.y, to.y))
		return (
			from.y > padded.bottom &&
			from.y < padded.top &&
			Math.max(from.x, to.x) > padded.left &&
			Math.min(from.x, to.x) < padded.right
		);
	if (closeCoordinate(from.x, to.x))
		return (
			from.x > padded.left &&
			from.x < padded.right &&
			Math.max(from.y, to.y) > padded.bottom &&
			Math.min(from.y, to.y) < padded.top
		);
	return false;
};

const orthogonalCandidateIsClear = (
	points: ReadonlyArray<Point>,
	obstacles: ReadonlyMap<string, Rectangle>,
) => {
	for (let index = 1; index < points.length; index += 1) {
		const from = points[index - 1] as Point;
		const to = points[index] as Point;
		for (const obstacle of obstacles.values())
			if (axisSegmentIntersectsRectangle(from, to, obstacle)) return false;
	}
	return true;
};

const simplifyOrthogonalPoints = (points: ReadonlyArray<Point>) => {
	const simplified: Point[] = [];
	for (const point of points) {
		const previous = simplified.at(-1);
		if (previous !== undefined && pointClose(previous, point)) continue;
		while (simplified.length >= 2) {
			const left = simplified.at(-2) as Point;
			const middle = simplified.at(-1) as Point;
			if (
				(closeCoordinate(left.x, middle.x) && closeCoordinate(middle.x, point.x)) ||
				(closeCoordinate(left.y, middle.y) && closeCoordinate(middle.y, point.y))
			)
				simplified.pop();
			else break;
		}
		simplified.push(point);
	}
	return simplified;
};

/** Converts safe corridor waypoints to a Manhattan backbone, preserving a safe diagonal fallback per segment. */
const readOrthogonalBackbone = (
	points: ReadonlyArray<Point>,
	obstacles: ReadonlyMap<string, Rectangle>,
) => {
	if (points.length < 2) return points;
	const result: Point[] = [
		points[0] as Point,
	];
	for (let index = 1; index < points.length; index += 1) {
		const from = result.at(-1) as Point;
		const to = points[index] as Point;
		if (closeCoordinate(from.x, to.x) || closeCoordinate(from.y, to.y)) {
			appendDistinctPoint(result, to);
			continue;
		}
		const middleX = (from.x + to.x) / 2;
		const middleY = (from.y + to.y) / 2;
		const candidates: ReadonlyArray<ReadonlyArray<Point>> = [
			[
				from,
				new Point(to.x, from.y),
				to,
			],
			[
				from,
				new Point(from.x, to.y),
				to,
			],
			[
				from,
				new Point(middleX, from.y),
				new Point(middleX, to.y),
				to,
			],
			[
				from,
				new Point(from.x, middleY),
				new Point(to.x, middleY),
				to,
			],
		];
		const candidate = candidates.find((path) => orthogonalCandidateIsClear(path, obstacles));
		if (candidate === undefined) {
			appendDistinctPoint(result, to);
			continue;
		}
		for (const point of candidate.slice(1)) appendDistinctPoint(result, point);
	}
	return simplifyOrthogonalPoints(result);
};

interface CorridorFrontEdge {
	readonly edge: CorridorEdge;
	readonly source: CorridorTriangle;
}

const triangleCenter = (triangle: CorridorTriangle) => {
	const a = triangle.Sites.getItem(0).point;
	const b = triangle.Sites.getItem(1).point;
	const c = triangle.Sites.getItem(2).point;
	return new Point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
};

const triangleInsideObstacle = (triangle: CorridorTriangle) => {
	const firstOwner = triangle.Sites.getItem(0).Owner;
	return (
		firstOwner !== undefined &&
		firstOwner !== null &&
		triangle.Sites.getItem(1).Owner === firstOwner &&
		triangle.Sites.getItem(2).Owner === firstOwner
	);
};

const recoverCongestionSleeve = (
	source: CorridorTriangle,
	target: CorridorTriangle,
	parentEdges: ReadonlyMap<CorridorTriangle, CorridorEdge>,
): CorridorFrontEdge[] => {
	const sleeve: CorridorFrontEdge[] = [];
	for (let current = target; current !== source; ) {
		const edge = parentEdges.get(current);
		if (edge === undefined) return [];
		const parent = edge.GetOtherTriangle_T(current);
		if (parent === undefined || parent === null) return [];
		sleeve.push({
			edge,
			source: parent,
		});
		current = parent;
	}
	return sleeve.reverse();
};

/** Spreads traffic across obstacle-safe CDT corridors before the selected-flow lane allocator runs. */
const readCongestionSleeve = (
	cdt: Cdt,
	source: Point,
	target: Point,
	usage: ReadonlyMap<CorridorEdge, number>,
): CorridorFrontEdge[] | undefined => {
	const sourceTriangle = findContainingTriangle(cdt, source);
	if (sourceTriangle === null) return undefined;
	const scores = new Map<CorridorTriangle, number>([
		[
			sourceTriangle,
			0,
		],
	]);
	const parentEdges = new Map<CorridorTriangle, CorridorEdge>();
	const open: Array<{
		readonly cost: number;
		readonly score: number;
		readonly triangle: CorridorTriangle;
	}> = [
		{
			cost: 0,
			score: distance(triangleCenter(sourceTriangle), target),
			triangle: sourceTriangle,
		},
	];

	while (open.length > 0) {
		let bestIndex = 0;
		for (let index = 1; index < open.length; index += 1)
			if (open[index]!.score < open[bestIndex]!.score) bestIndex = index;
		const [{ cost, triangle }] = open.splice(bestIndex, 1);
		const currentScore = scores.get(triangle);
		if (currentScore === undefined || cost > currentScore) continue;
		if (triangle.containsPoint(target))
			return recoverCongestionSleeve(sourceTriangle, triangle, parentEdges);

		const entryEdge = parentEdges.get(triangle);
		const entry =
			entryEdge === undefined
				? triangleCenter(triangle)
				: new Point(
						(entryEdge.lowerSite.point.x + entryEdge.upperSite.point.x) / 2,
						(entryEdge.lowerSite.point.y + entryEdge.upperSite.point.y) / 2,
					);
		for (const edge of triangle.Edges) {
			if (edge === entryEdge) continue;
			const next = edge.GetOtherTriangle_T(triangle);
			if (next === undefined || next === null) continue;
			if (triangleInsideObstacle(next) && !next.containsPoint(target)) continue;
			const midpoint = new Point(
				(edge.lowerSite.point.x + edge.upperSite.point.x) / 2,
				(edge.lowerSite.point.y + edge.upperSite.point.y) / 2,
			);
			const segmentLength = distance(entry, midpoint);
			const edgeUsage = Math.min(CorridorCongestionCap, usage.get(edge) ?? 0);
			const congestionPenalty =
				edgeUsage * CorridorCongestionBasePenalty +
				segmentLength * edgeUsage * CorridorCongestionLengthFactor;
			const candidateScore = currentScore + segmentLength + congestionPenalty;
			if (candidateScore >= (scores.get(next) ?? Number.POSITIVE_INFINITY)) continue;
			scores.set(next, candidateScore);
			parentEdges.set(next, edge);
			open.push({
				cost: candidateScore,
				score: candidateScore + distance(midpoint, target),
				triangle: next,
			});
		}
	}
	return undefined;
};

const routeCongestionAwareCorridor = (
	cdt: Cdt,
	source: Point,
	target: Point,
	usage: Map<CorridorEdge, number>,
) => {
	const sleeve = readCongestionSleeve(cdt, source, target, usage);
	if (sleeve === undefined) return undefined;
	for (const { edge } of sleeve) usage.set(edge, (usage.get(edge) ?? 0) + 1);
	if (sleeve.length === 0)
		return [
			source,
			target,
		];
	const diagonals = sleeveToDiagonals(sleeve);
	return funnelFromDiagonals(source, target, diagonals);
};

const routePortAwareEdges = (
	flow: EditorItemOriginFlowLayoutInput,
	geomNodes: ReadonlyMap<string, GeomNode>,
	geomEdges: ReadonlyMap<string, GeomEdge>,
): {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>>;
} => {
	const obstacles: Polyline[] = [];
	const nodeObstaclesById = new Map(
		[
			...geomNodes,
		].map(
			([nodeId, geomNode]) =>
				[
					nodeId,
					geomNode.boundingBox.clone(),
				] as const,
		),
	);
	const nodeObstacles = [
		...nodeObstaclesById.values(),
	];
	const bounds = Rectangle.mkEmpty();
	for (const geomNode of geomNodes.values()) {
		const obstacle = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(
			geomNode.boundaryCurve,
			EdgePadding,
		);
		obstacles.push(obstacle);
		bounds.addRecSelf(obstacle.boundingBox);
	}
	bounds.pad(Math.max(bounds.diagonal / 4, 100));
	obstacles.push(bounds.perimeter());

	const cdt = new Cdt([], obstacles, []);
	cdt.run();

	const backbones = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	const routes = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>>();
	const corridorUsage = new Map<CorridorEdge, number>();
	for (const input of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const geomEdge = geomEdges.get(input.id);
		if (geomEdge?.sourcePort === undefined || geomEdge.targetPort === undefined)
			throw new Error(`Flow edge ${input.id} is missing port geometry.`);

		const source = geomEdge.sourcePort.Location;
		const target = geomEdge.targetPort.Location;
		const sourceEscape = source.add(new Point(PortEscape, 0));
		const targetEscape = target.add(new Point(-PortEscape, 0));
		const routed = routeCongestionAwareCorridor(cdt, sourceEscape, targetEscape, corridorUsage);
		if (routed === undefined)
			throw new Error(`MSAGL could not route edge ${input.id} between its ports.`);

		const corePoints: Point[] = [];
		appendDistinctPoint(corePoints, sourceEscape);
		for (const point of routed) appendDistinctPoint(corePoints, point);
		appendDistinctPoint(corePoints, targetEscape);
		const simplifiedCore = [
			...Polyline.mkFromPoints(corePoints).RemoveCollinearVertices(),
		];
		const backbonePoints: Point[] = [];
		appendDistinctPoint(backbonePoints, source);
		for (const point of simplifiedCore) appendDistinctPoint(backbonePoints, point);
		appendDistinctPoint(backbonePoints, target);
		const orthogonalBackbone = readOrthogonalBackbone(backbonePoints, nodeObstaclesById);
		backbones.set(input.id, orthogonalBackbone.map(toLayoutPoint));

		const route: EditorItemOriginFlowLayoutRouteSegment[] = [];
		if (!pointClose(source, sourceEscape)) route.push(readLineSegment(source, sourceEscape));
		route.push(
			...smoothRoute(
				simplifiedCore,
				normalize(sourceEscape.sub(source)),
				normalize(target.sub(targetEscape)),
				nodeObstacles,
			),
		);
		if (!pointClose(targetEscape, target)) route.push(readLineSegment(targetEscape, target));
		if (route.length === 0)
			throw new Error(`MSAGL returned an empty route for edge ${input.id}.`);
		routes.set(input.id, route);
	}
	return {
		backbones,
		routes,
	};
};

const runLayout = (flow: EditorItemOriginFlowLayoutInput): EditorItemOriginFlowLayout => {
	if (flow.nodes.length === 0)
		return {
			backbones: new Map(),
			positions: new Map(),
			routes: new Map(),
		};

	const weightedGraph = readWeightedGraph(flow);
	const flowOrder = readFlowOrder(flow, weightedGraph);
	const graph = new Graph("arkini-editor-origin-flow");
	const geomGraph = new GeomGraph(graph);
	const nodes = new Map<string, Node>();
	const geomNodes = new Map<string, GeomNode>();
	const ports = new Map<string, RelativeFloatingPort>();
	const geomEdges = new Map<string, GeomEdge>();

	for (const input of [
		...flow.nodes,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const node = new Node(input.id);
		graph.addNode(node);
		nodes.set(input.id, node);
		const geomNode = GeomNode.mkNode(
			CurveFactory.createRectangle(input.width, input.height, new Point(0, 0)),
			node,
		);
		geomNodes.set(input.id, geomNode);
		for (const port of input.ports) {
			ports.set(
				`${input.id}:${port.id}`,
				new RelativeFloatingPort(
					() => geomNode.boundaryCurve,
					() => geomNode.center,
					new Point(port.x, port.y),
				),
			);
		}
	}
	for (const input of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const source = nodes.get(input.source);
		const target = nodes.get(input.target);
		if (source === undefined || target === undefined)
			throw new Error(
				`Flow edge references an unknown node: ${input.source} -> ${input.target}.`,
			);
		const geomEdge = new GeomEdge(new Edge(source, target));
		const sourceGeomNode = geomNodes.get(input.source);
		const targetGeomNode = geomNodes.get(input.target);
		if (sourceGeomNode === undefined || targetGeomNode === undefined)
			throw new Error(`Missing flow geometry for ${input.source} -> ${input.target}.`);
		const sourcePort =
			input.sourcePortId === undefined
				? new RelativeFloatingPort(
						() => sourceGeomNode.boundaryCurve,
						() => sourceGeomNode.center,
						new Point(sourceGeomNode.boundingBox.width / 2, 0),
					)
				: ports.get(`${input.source}:${input.sourcePortId}`);
		const targetPort =
			input.targetPortId === undefined
				? new RelativeFloatingPort(
						() => targetGeomNode.boundaryCurve,
						() => targetGeomNode.center,
						new Point(-targetGeomNode.boundingBox.width / 2, 0),
					)
				: ports.get(`${input.target}:${input.targetPortId}`);
		if (sourcePort === undefined || targetPort === undefined)
			throw new Error(`Flow edge ${input.id} references an unknown port.`);
		geomEdge.sourcePort = sourcePort;
		geomEdge.targetPort = targetPort;
		geomEdges.set(input.id, geomEdge);
	}

	const settings = new FastIncrementalLayoutSettings();
	settings.AvoidOverlaps = true;
	settings.NodeSeparation = NodeSeparation;
	settings.PackingAspectRatio = PackingAspectRatio;
	settings.RepulsiveForceConstant = 2.8;
	settings.AttractiveForceConstant = 0.72;
	settings.GravityConstant = 0.65;
	settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None;
	geomGraph.layoutSettings = settings;
	layoutGeomGraph(geomGraph);

	const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
	for (const geomNode of geomGraph.shallowNodes) {
		const order = flowOrder.get(geomNode.id);
		if (order === undefined) throw new Error(`Missing flow order for ${geomNode.id}.`);
		const bounds = geomNode.boundingBox;
		positions.set(geomNode.id, {
			flowOrder: order,
			height: bounds.height,
			width: bounds.width,
			x: bounds.left,
			y: bounds.bottom,
		});
	}
	if (positions.size !== flow.nodes.length)
		throw new Error(`MSAGL returned ${positions.size} of ${flow.nodes.length} nodes.`);

	const { backbones, routes } = routePortAwareEdges(flow, geomNodes, geomEdges);
	if (routes.size !== flow.edges.length)
		throw new Error(`MSAGL returned ${routes.size} of ${flow.edges.length} edge routes.`);
	if (backbones.size !== flow.edges.length)
		throw new Error(`MSAGL returned ${backbones.size} of ${flow.edges.length} edge backbones.`);

	return {
		backbones,
		positions,
		routes,
	};
};

/** Computes deterministic organic MSAGL positions and exact port-aware obstacle routes. */
export const layoutEditorItemOriginFlowFx = Effect.fn("layoutEditorItemOriginFlowFx")(
	(flow: EditorItemOriginFlowLayoutInput) => Effect.sync(() => runLayout(flow)),
);
