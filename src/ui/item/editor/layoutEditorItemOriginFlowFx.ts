import {
	BezierSeg,
	Curve,
	CurveFactory,
	Edge,
	EdgeRoutingMode,
	FastIncrementalLayoutSettings,
	GeomEdge,
	GeomGraph,
	GeomNode,
	Graph,
	type ICurve,
	LineSegment,
	Node,
	Point,
	layoutGeomGraph,
} from "@msagl/core";
import { Effect } from "effect";

export interface EditorItemOriginFlowLayoutInput {
	readonly edges: ReadonlyArray<{
		readonly id: string;
		readonly source: string;
		readonly target: string;
	}>;
	readonly nodes: ReadonlyArray<{
		readonly id: string;
		readonly kind: "item" | "source";
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
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>>;
}

const NodeWidth = 420;
const NodeHeight = 176;
const NodeSeparation = 24;
const PackingAspectRatio = 1.6;
const EdgePadding = 8;

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

const readCurveSegments = (curve: ICurve): EditorItemOriginFlowLayoutRouteSegment[] => {
	if (curve instanceof LineSegment)
		return [
			{
				from: toLayoutPoint(curve.start),
				kind: "line",
				to: toLayoutPoint(curve.end),
			},
		];
	if (curve instanceof BezierSeg)
		return [
			{
				control1: toLayoutPoint(curve.B(1)),
				control2: toLayoutPoint(curve.B(2)),
				from: toLayoutPoint(curve.B(0)),
				kind: "cubic",
				to: toLayoutPoint(curve.B(3)),
			},
		];
	if (curve instanceof Curve) return curve.segs.flatMap(readCurveSegments);
	throw new Error(`MSAGL returned unsupported route geometry: ${curve.constructor.name}.`);
};

const runLayout = (flow: EditorItemOriginFlowLayoutInput): EditorItemOriginFlowLayout => {
	if (flow.nodes.length === 0)
		return {
			positions: new Map(),
			routes: new Map(),
		};

	const weightedGraph = readWeightedGraph(flow);
	const flowOrder = readFlowOrder(flow, weightedGraph);
	const graph = new Graph("arkini-editor-origin-flow");
	const geomGraph = new GeomGraph(graph);
	const nodes = new Map<string, Node>();
	const geomEdges = new Map<string, GeomEdge>();

	for (const input of [
		...flow.nodes,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const node = new Node(input.id);
		graph.addNode(node);
		nodes.set(input.id, node);
		GeomNode.mkNode(CurveFactory.createRectangle(NodeWidth, NodeHeight, new Point(0, 0)), node);
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
		geomEdges.set(input.id, new GeomEdge(new Edge(source, target)));
	}

	const settings = new FastIncrementalLayoutSettings();
	settings.AvoidOverlaps = true;
	settings.NodeSeparation = NodeSeparation;
	settings.PackingAspectRatio = PackingAspectRatio;
	settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor;
	settings.edgeRoutingSettings.Padding = EdgePadding;
	settings.edgeRoutingSettings.smoothCorners = true;
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

	const routes = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutRouteSegment>>();
	for (const input of [
		...flow.edges,
	].sort((left, right) => left.id.localeCompare(right.id))) {
		const curve = geomEdges.get(input.id)?.curve;
		if (curve === undefined || curve === null)
			throw new Error(`MSAGL omitted the route for edge ${input.id}.`);
		const route = readCurveSegments(curve);
		if (route.length === 0)
			throw new Error(`MSAGL returned an empty route for edge ${input.id}.`);
		routes.set(input.id, route);
	}
	if (routes.size !== flow.edges.length)
		throw new Error(`MSAGL returned ${routes.size} of ${flow.edges.length} edge routes.`);

	return {
		positions,
		routes,
	};
};

/** Computes deterministic organic MSAGL positions and obstacle-aware curved routes. */
export const layoutEditorItemOriginFlowFx = Effect.fn("layoutEditorItemOriginFlowFx")(
	(flow: EditorItemOriginFlowLayoutInput) => Effect.sync(() => runLayout(flow)),
);
