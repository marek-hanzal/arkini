import { Effect, Order } from "effect";
import { useEffect, useMemo, useState } from "react";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorItemOriginFlow } from "~/flow/type/EditorItemOriginFlow";
import { readHighlightFn } from "~/flow-canvas/fn/readHighlightFn";
import type { Highlight, OriginFlowDirection, Selection } from "~/flow-canvas/type/Highlight";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";

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

const appendPoint = (points: LayoutPoint[], point: LayoutPoint) => {
	const previous = points.at(-1);
	if (
		previous === undefined ||
		!sameCoordinate(previous.x, point.x) ||
		!sameCoordinate(previous.y, point.y)
	)
		points.push(point);
};

const normalizeBackbone = (points: ReadonlyArray<LayoutPoint>): ReadonlyArray<LayoutPoint> => {
	const normalized: LayoutPoint[] = [];
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
	from: LayoutPoint,
	to: LayoutPoint,
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

const readOffsetIntersection = (
	point: LayoutPoint,
	previous: MetroSegment,
	previousOffset: number,
	next: MetroSegment,
	nextOffset: number,
): LayoutPoint => {
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
const readMetroBackbonesFx = Effect.fn("readMetroBackbonesFx")(
	(
		backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>,
		highlightedEdgeIds: ReadonlyArray<string>,
	) =>
		Effect.sync((): ReadonlyMap<string, ReadonlyArray<LayoutPoint>> => {
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

interface FlowNavigationPosition {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

const readCenter = (position: FlowNavigationPosition) => ({
	x: position.x + position.width / 2,
	y: position.y + position.height / 2,
});

const readDistance = (left: FlowNavigationPosition, right: FlowNavigationPosition) => {
	const leftCenter = readCenter(left);
	const rightCenter = readCenter(right);
	return Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y);
};

const readTurnCost = (
	previous: FlowNavigationPosition | undefined,
	current: FlowNavigationPosition,
	target: FlowNavigationPosition,
) => {
	if (previous === undefined) return 0;
	const previousCenter = readCenter(previous);
	const currentCenter = readCenter(current);
	const targetCenter = readCenter(target);
	const incomingX = currentCenter.x - previousCenter.x;
	const incomingY = currentCenter.y - previousCenter.y;
	const outgoingX = targetCenter.x - currentCenter.x;
	const outgoingY = targetCenter.y - currentCenter.y;
	const incomingLength = Math.hypot(incomingX, incomingY);
	const outgoingLength = Math.hypot(outgoingX, outgoingY);
	if (incomingLength === 0 || outgoingLength === 0) return 0;
	const cosine =
		(incomingX * outgoingX + incomingY * outgoingY) / (incomingLength * outgoingLength);
	return 1 - Math.max(-1, Math.min(1, cosine));
};

/** Reads one stable depth-first walk through the active directional flow. */
const readNavigationFn = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNavigationPosition>,
	startNodeId: string,
	direction: OriginFlowDirection,
	allowedEdgeIds?: ReadonlySet<string>,
): ReadonlyArray<string> => {
	if (!flow.nodes.some(({ id }) => id === startNodeId) || !positions.has(startNodeId)) return [];

	const targetsBySource = new Map<string, Set<string>>();
	for (const edge of flow.edges) {
		if (allowedEdgeIds !== undefined && !allowedEdgeIds.has(edge.id)) continue;
		const sourceId = direction === "output" ? edge.target : edge.source;
		const targetId = direction === "output" ? edge.source : edge.target;
		const source = positions.get(sourceId);
		const target = positions.get(targetId);
		if (source === undefined || target === undefined) continue;
		const movesWithDirection =
			allowedEdgeIds !== undefined ||
			(direction === "output"
				? target.flowOrder < source.flowOrder
				: target.flowOrder > source.flowOrder);
		if (!movesWithDirection) continue;
		const targets = targetsBySource.get(sourceId) ?? new Set<string>();
		targets.add(targetId);
		targetsBySource.set(sourceId, targets);
	}

	const visited = new Set<string>();
	const ordered: string[] = [];
	const visit = (nodeId: string, previousNodeId?: string) => {
		if (visited.has(nodeId)) return;
		const current = positions.get(nodeId);
		if (current === undefined) return;
		visited.add(nodeId);
		ordered.push(nodeId);
		const previous = previousNodeId === undefined ? undefined : positions.get(previousNodeId);
		const targets = [
			...(targetsBySource.get(nodeId) ?? []),
		].sort((leftId, rightId) => {
			const left = positions.get(leftId)!;
			const right = positions.get(rightId)!;
			const turnDifference =
				readTurnCost(previous, current, left) - readTurnCost(previous, current, right);
			if (Math.abs(turnDifference) > 1e-9) return turnDifference;
			const flowDifference =
				Math.abs(left.flowOrder - current.flowOrder) -
				Math.abs(right.flowOrder - current.flowOrder);
			if (flowDifference !== 0) return flowDifference;
			const distanceDifference = readDistance(current, left) - readDistance(current, right);
			if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
			return Order.String(leftId, rightId);
		});
		for (const targetId of targets) visit(targetId, nodeId);
	};
	visit(startNodeId);
	return ordered;
};

/** Reads stable item navigation for nodes that use the selected item in one operation role. */
const readRelationNavigationFn = ({
	flow,
	selectedNodeId,
	selectedRole,
}: {
	readonly flow: EditorItemOriginFlow;
	readonly selectedNodeId: string;
	readonly selectedRole: "input" | "output";
}): ReadonlyArray<string> => {
	const nodesById = new Map(
		flow.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const relatedNodeIds = new Set<string>();
	for (const edge of flow.edges) {
		const relatedNodeId =
			selectedRole === "input"
				? edge.role === "input" && edge.source === selectedNodeId
					? edge.target
					: undefined
				: edge.role === "output" && edge.target === selectedNodeId
					? edge.source
					: undefined;
		if (
			relatedNodeId === undefined ||
			relatedNodeId === selectedNodeId ||
			!nodesById.has(relatedNodeId)
		)
			continue;
		relatedNodeIds.add(relatedNodeId);
	}
	return [
		...relatedNodeIds,
	].sort((leftId, rightId) => {
		const left = nodesById.get(leftId)!;
		const right = nodesById.get(rightId)!;
		return (
			Order.String(left.title, right.title) ||
			Order.String(left.itemId, right.itemId) ||
			Order.String(leftId, rightId)
		);
	});
};

/** Reads terminal/root nodes from the complete selected directional graph, farthest first. */
const readRootNavigationFn = (
	flow: EditorItemOriginFlow,
	highlight: Highlight,
): ReadonlyArray<string> => {
	const nodesById = new Map(
		flow.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const adjacency = new Map<string, Set<string>>();
	const connect = (left: string, right: string) => {
		const neighbors = adjacency.get(left) ?? new Set<string>();
		neighbors.add(right);
		adjacency.set(left, neighbors);
	};
	for (const edge of flow.edges) {
		if (!highlight.edgeIds.has(edge.id) || edge.source === edge.target) continue;
		connect(edge.source, edge.target);
		connect(edge.target, edge.source);
	}
	return [
		...highlight.nodeIds,
	]
		.filter((nodeId) => {
			const level = highlight.nodeLevels.get(nodeId);
			if (level === undefined) return false;
			return [
				...(adjacency.get(nodeId) ?? []),
			].every((neighborId) => (highlight.nodeLevels.get(neighborId) ?? -1) <= level);
		})
		.sort((leftId, rightId) => {
			const leftLevel = highlight.nodeLevels.get(leftId) ?? 0;
			const rightLevel = highlight.nodeLevels.get(rightId) ?? 0;
			if (leftLevel !== rightLevel) return rightLevel - leftLevel;
			const left = nodesById.get(leftId);
			const right = nodesById.get(rightId);
			const starterDifference =
				Number((right?.starterScopes.length ?? 0) > 0) -
				Number((left?.starterScopes.length ?? 0) > 0);
			if (starterDifference !== 0) return starterDifference;
			return (
				Order.String(left?.title ?? leftId, right?.title ?? rightId) ||
				Order.String(leftId, rightId)
			);
		});
};

const HighlightRouteColors = Array.from(
	{
		length: 64,
	},
	(_, index) => {
		const hue = (index * 137.50776405003785) % 360;
		const saturation = [
			88,
			76,
			94,
			70,
		][index % 4]!;
		const lightness = [
			38,
			48,
			32,
			56,
		][index % 4]!;
		return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
	},
);

const hashText = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

/** Projects stable colors onto selected flow routes and their connected ports. */
const readRouteColorsFn = (
	flow: EditorItemOriginFlow,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
) => {
	if (selection === undefined)
		return {
			edges: new Map<string, string>(),
			ports: new Map<string, ReadonlyMap<string, string>>(),
		};
	const highlightedIds = new Set(highlight?.edgeIds ?? []);
	if (selection.kind === "edge") highlightedIds.add(selection.id);
	const edgeIds = flow.edges
		.map(({ id }) => id)
		.filter((id) => highlightedIds.has(id))
		.sort((left, right) => Order.String(left, right));
	const offset = hashText(selection.id) % HighlightRouteColors.length;
	const edges = new Map(
		edgeIds.map(
			(edgeId, index) =>
				[
					edgeId,
					HighlightRouteColors[(offset + index) % HighlightRouteColors.length]!,
				] as const,
		),
	);
	const ports = new Map<string, Map<string, string>>();
	const writePort = (nodeId: string, portId: string | undefined, color: string) => {
		if (portId === undefined) return;
		const colors = ports.get(nodeId) ?? new Map<string, string>();
		if (!colors.has(portId)) colors.set(portId, color);
		ports.set(nodeId, colors);
	};
	for (const edge of flow.edges) {
		const color = edges.get(edge.id);
		if (color === undefined) continue;
		writePort(edge.source, edge.sourcePortId, color);
		writePort(edge.target, edge.targetPortId, color);
	}
	return {
		edges,
		ports: ports as ReadonlyMap<string, ReadonlyMap<string, string>>,
	};
};

export const DefaultHighlightDepth = 1;

export interface HighlightDepth {
	readonly direction: OriginFlowDirection;
	readonly limit: number;
	readonly nodeId: string;
}

const readVisibleHighlightFn = (highlight: Highlight, maxLevel: number): Highlight => {
	const boundedLevel = Math.max(0, Math.floor(maxLevel));
	const nodeLevels = new Map(
		[
			...highlight.nodeLevels,
		].filter(([, level]) => level <= boundedLevel),
	);
	const edgeLevels = new Map(
		[
			...highlight.edgeLevels,
		].filter(([, level]) => level <= boundedLevel),
	);
	return {
		edgeIds: new Set(edgeLevels.keys()),
		edgeLevels,
		nodeIds: new Set(nodeLevels.keys()),
		nodeLevels,
	};
};

/** Owns the complete direction-aware selection and navigation projection for one flow canvas. */
export const useProjection = ({
	backbones,
	direction,
	flow,
	positions,
	selection,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly direction: OriginFlowDirection;
	readonly flow: EditorItemOriginFlow;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly selection: Selection | undefined;
}) => {
	const [highlightDepth, setHighlightDepth] = useState<HighlightDepth>();
	const completeHighlight = useMemo(
		() => (selection === undefined ? undefined : readHighlightFn(flow, selection, direction)),
		[
			direction,
			flow,
			selection,
		],
	);
	const maxHighlightLevel = useMemo(
		() =>
			completeHighlight === undefined
				? 0
				: Math.max(0, ...completeHighlight.nodeLevels.values()),
		[
			completeHighlight,
		],
	);
	const highlightDepthLimit =
		selection?.kind === "node"
			? Math.min(
					highlightDepth?.nodeId === selection.id &&
						highlightDepth.direction === direction
						? highlightDepth.limit
						: DefaultHighlightDepth,
					maxHighlightLevel,
				)
			: undefined;
	const highlight = useMemo(
		() =>
			selection?.kind !== "node" ||
			completeHighlight === undefined ||
			highlightDepthLimit === undefined ||
			highlightDepthLimit >= maxHighlightLevel
				? completeHighlight
				: readVisibleHighlightFn(completeHighlight, highlightDepthLimit),
		[
			completeHighlight,
			highlightDepthLimit,
			maxHighlightLevel,
			selection,
		],
	);
	const routeColors = useMemo(
		() => readRouteColorsFn(flow, selection, highlight),
		[
			flow,
			highlight,
			selection,
		],
	);
	const highlightedEdgeColors = routeColors.edges;
	const metroBackbones = useMemo(
		() =>
			RendererRuntime.runSync(
				readMetroBackbonesFx(backbones, [
					...highlightedEdgeColors.keys(),
				]),
			),
		[
			backbones,
			highlightedEdgeColors,
		],
	);
	const highlightedPortColors = routeColors.ports;
	const navigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readNavigationFn(flow, positions, selection.id, direction, highlight?.edgeIds)
				: [],
		[
			direction,
			flow,
			highlight,
			positions,
			selection,
		],
	);
	const inputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readRelationNavigationFn({
						flow,
						selectedNodeId: selection.id,
						selectedRole: "input",
					})
				: [],
		[
			flow,
			selection,
		],
	);
	const outputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readRelationNavigationFn({
						flow,
						selectedNodeId: selection.id,
						selectedRole: "output",
					})
				: [],
		[
			flow,
			selection,
		],
	);
	const rootNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node" && completeHighlight !== undefined
				? readRootNavigationFn(flow, completeHighlight)
				: [],
		[
			completeHighlight,
			flow,
			selection,
		],
	);

	useEffect(
		() => setHighlightDepth(undefined),
		[
			direction,
			selection,
		],
	);

	return {
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		inputNavigationNodeIds,
		maxHighlightLevel,
		metroBackbones,
		navigationNodeIds,
		outputNavigationNodeIds,
		rootNavigationNodeIds,
		setHighlightDepth,
	};
};
