import type { ElkEdgeSection, ElkExtendedEdge, ElkNode, ElkPoint } from "elkjs/lib/elk-api.js";

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
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayoutPoint {
	readonly x: number;
	readonly y: number;
}

export interface EditorItemOriginFlowLayout {
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
}

const GoldenRatio = (1 + Math.sqrt(5)) / 2;
const NodeWidth = 224;
const NodeHeight = Math.round(NodeWidth / GoldenRatio);
const NodeSize = {
	item: {
		height: NodeHeight,
		width: NodeWidth,
	},
	source: {
		height: NodeHeight,
		width: NodeWidth,
	},
} as const;

const LayoutOptions = {
	"elk.algorithm": "layered",
	"elk.direction": "RIGHT",
	"elk.edgeRouting": "SPLINES",
	"elk.layered.edgeRouting.splines.mode": "CONSERVATIVE",
	"elk.layered.spacing.edgeEdgeBetweenLayers": "14",
	"elk.layered.spacing.edgeNodeBetweenLayers": "20",
	"elk.layered.spacing.nodeNodeBetweenLayers": "72",
	"elk.padding": "[top=20,left=20,bottom=20,right=20]",
	"elk.randomSeed": "1",
	"elk.spacing.edgeEdge": "14",
	"elk.spacing.edgeNode": "20",
	"elk.spacing.nodeNode": "36",
} as const;

type EditorItemOriginFlowElkLayout = (graph: ElkNode) => Promise<ElkNode>;

const readInputPortId = (nodeId: string) => `${nodeId}:input`;
const readOutputPortId = (nodeId: string) => `${nodeId}:output`;

const readNumber = (value: number | undefined, label: string) => {
	if (value === undefined || !Number.isFinite(value)) throw new Error(`ELK omitted ${label}.`);
	return value;
};

const pointsEqual = (left: ElkPoint, right: ElkPoint) => left.x === right.x && left.y === right.y;

const readRoute = (edge: ElkExtendedEdge): ReadonlyArray<ElkPoint> => {
	const sections = edge.sections ?? [];
	if (sections.length === 0) throw new Error(`ELK omitted the route for edge ${edge.id}.`);
	const remaining = new Map(
		sections.map((section) => [
			section.id,
			section,
		]),
	);
	let section: ElkEdgeSection | undefined =
		sections.find(({ incomingSections }) => (incomingSections?.length ?? 0) === 0) ??
		sections[0];
	const route: ElkPoint[] = [];
	while (section !== undefined) {
		remaining.delete(section.id);
		const points = [
			section.startPoint,
			...(section.bendPoints ?? []),
			section.endPoint,
		];
		if (route.length > 0 && !pointsEqual(route.at(-1)!, points[0]!))
			throw new Error(`ELK returned disconnected sections for edge ${edge.id}.`);
		route.push(...(route.length === 0 ? points : points.slice(1)));

		const outgoing: ReadonlyArray<string> = section.outgoingSections ?? [];
		if (outgoing.length > 1)
			throw new Error(`ELK returned branching sections for edge ${edge.id}.`);
		section =
			(outgoing[0] === undefined ? undefined : remaining.get(outgoing[0])) ??
			[
				...remaining.values(),
			].find((candidate) => pointsEqual(candidate.startPoint, route.at(-1)!));
	}
	if (remaining.size > 0)
		throw new Error(`ELK returned disconnected sections for edge ${edge.id}.`);
	if (route.length < 4 || (route.length - 1) % 3 !== 0)
		throw new Error(`ELK returned a malformed cubic spline for edge ${edge.id}.`);
	return route;
};

/** Computes deterministic golden-ratio cards and obstacle-avoiding cubic spline routes. */
export const layoutEditorItemOriginFlow = async (
	flow: EditorItemOriginFlowLayoutInput,
	layout: EditorItemOriginFlowElkLayout,
): Promise<EditorItemOriginFlowLayout> => {
	const graph = await layout({
		children: [
			...flow.nodes,
		]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map(({ id, kind }) => {
				const size = NodeSize[kind];
				return {
					...size,
					id,
					layoutOptions: {
						"elk.portConstraints": "FIXED_POS",
					},
					ports: [
						{
							height: 6,
							id: readInputPortId(id),
							width: 6,
							x: -3,
							y: size.height / 2 - 3,
						},
						{
							height: 6,
							id: readOutputPortId(id),
							width: 6,
							x: size.width - 3,
							y: size.height / 2 - 3,
						},
					],
				};
			}),
		edges: [
			...flow.edges,
		]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map(({ id, source, target }) => ({
				id,
				sources: [
					readOutputPortId(source),
				],
				targets: [
					readInputPortId(target),
				],
			})),
		id: "root",
		layoutOptions: LayoutOptions,
	} satisfies ElkNode);

	const positions = new Map<string, EditorItemOriginFlowLayoutNode>();
	for (const node of graph.children ?? []) {
		positions.set(node.id, {
			height: readNumber(node.height, `height for node ${node.id}`),
			width: readNumber(node.width, `width for node ${node.id}`),
			x: readNumber(node.x, `x for node ${node.id}`),
			y: readNumber(node.y, `y for node ${node.id}`),
		});
	}
	if (positions.size !== flow.nodes.length)
		throw new Error(`ELK returned ${positions.size} of ${flow.nodes.length} nodes.`);

	const routes = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
	for (const edge of graph.edges ?? []) routes.set(edge.id, readRoute(edge));
	if (routes.size !== flow.edges.length)
		throw new Error(`ELK returned ${routes.size} of ${flow.edges.length} edge routes.`);

	return {
		positions,
		routes,
	};
};
