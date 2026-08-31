import { Order } from "effect";
import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import {
	ItemOriginItemInputPortId,
	ItemOriginItemOutputPortId,
	type ItemOriginFlow,
} from "~/flow/type/ItemOriginFlow";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import type { ConnectedPorts } from "~/flow-canvas/fn/readConnectedPortsFn";
import {
	readDefaultOriginFlowViewportFn,
	readOriginFlowNodeViewportFn,
} from "~/flow-canvas/fn/readOriginFlowViewportFn";
import type { Highlight, Selection } from "~/flow-canvas/type/Highlight";
import type { NodeMetrics } from "~/flow-layout/fn/readNodeMetricsFn";
import type { Viewport } from "~/flow-canvas/type/Viewport";

type Hit =
	| Selection
	| {
			readonly kind: "port";
			readonly targetNodeId: string;
	  }
	| {
			readonly itemId: string;
			readonly kind: "item-detail";
	  };

const distanceToSegment = (x: number, y: number, start: LayoutPoint, end: LayoutPoint) => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return Math.hypot(x - start.x, y - start.y);
	const t = Math.max(
		0,
		Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)),
	);
	return Math.hypot(x - (start.x + t * dx), y - (start.y + t * dy));
};

const distanceToRoute = (x: number, y: number, points: ReadonlyArray<LayoutPoint>) => {
	let distance = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1)
		distance = Math.min(distance, distanceToSegment(x, y, points[index - 1]!, points[index]!));
	return distance;
};

/** Resolves the topmost selectable port, node, or routed edge at one world position. */
const readHitFn = ({
	backbones,
	connectedPorts,
	flow,
	highlight,
	metroBackbones,
	nodeMetrics,
	positions,
	selection,
	x,
	y,
	zoom,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly connectedPorts: ConnectedPorts;
	readonly flow: ItemOriginFlow;
	readonly highlight: Highlight | undefined;
	readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly selection: Selection | undefined;
	readonly x: number;
	readonly y: number;
	readonly zoom: number;
}): Hit | undefined => {
	const isNodeRelevant = (nodeId: string) =>
		selection?.kind !== "node" || highlight?.nodeIds.has(nodeId) === true;
	const isEdgeRelevant = (edgeId: string) =>
		selection?.kind !== "node" || highlight?.edgeIds.has(edgeId) === true;
	const portTolerance = 11 / zoom;
	for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
		const node = flow.nodes[index]!;
		if (!isNodeRelevant(node.id)) continue;
		const position = positions.get(node.id);
		const metrics = nodeMetrics.get(node.id);
		if (position === undefined || metrics === undefined) continue;
		const connectedPortIds = connectedPorts.get(node.id);
		const readItemPortTarget = (portId: string) =>
			flow.edges
				.filter((edge) =>
					portId === ItemOriginItemInputPortId
						? edge.target === node.id && edge.targetPortId === portId
						: edge.source === node.id && edge.sourcePortId === portId,
				)
				.sort((left, right) => Order.String(left.id, right.id))
				.map((edge) => (portId === ItemOriginItemInputPortId ? edge.source : edge.target))
				.find((targetNodeId) => positions.has(targetNodeId));
		if (
			connectedPortIds?.has(ItemOriginItemInputPortId) === true &&
			Math.hypot(x - position.x, y - (position.y + metrics.itemPortY)) <= portTolerance
		) {
			const targetNodeId = readItemPortTarget(ItemOriginItemInputPortId);
			if (targetNodeId !== undefined)
				return {
					kind: "port",
					targetNodeId,
				};
		}
		if (
			connectedPortIds?.has(ItemOriginItemOutputPortId) === true &&
			Math.hypot(x - (position.x + position.width), y - (position.y + metrics.itemPortY)) <=
				portTolerance
		) {
			const targetNodeId = readItemPortTarget(ItemOriginItemOutputPortId);
			if (targetNodeId !== undefined)
				return {
					kind: "port",
					targetNodeId,
				};
		}
		for (const [operationIndex, operation] of node.operations.entries()) {
			const operationMetrics = metrics.operations[operationIndex];
			if (operationMetrics === undefined) continue;
			for (const input of operation.inputs) {
				const localY = operationMetrics.inputPortYs.get(input.id);
				if (
					connectedPortIds?.has(input.id) === true &&
					localY !== undefined &&
					Math.hypot(x - position.x, y - (position.y + localY)) <= portTolerance &&
					positions.has(`item:${input.itemId}`)
				)
					return {
						kind: "port",
						targetNodeId: `item:${input.itemId}`,
					};
			}
			for (const output of operation.outputs) {
				const localY = operationMetrics.outputPortYs.get(output.id);
				if (
					connectedPortIds?.has(output.id) === true &&
					localY !== undefined &&
					Math.hypot(x - (position.x + position.width), y - (position.y + localY)) <=
						portTolerance &&
					positions.has(`item:${output.itemId}`)
				)
					return {
						kind: "port",
						targetNodeId: `item:${output.itemId}`,
					};
			}
		}
		const itemTextBounds = metrics.itemTextBounds;
		if (
			x >= position.x + itemTextBounds.x &&
			x <= position.x + itemTextBounds.x + itemTextBounds.width &&
			y >= position.y + itemTextBounds.y &&
			y <= position.y + itemTextBounds.y + itemTextBounds.height
		)
			return {
				itemId: node.itemId,
				kind: "item-detail",
			};
	}
	for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
		const node = flow.nodes[index]!;
		const position = positions.get(node.id);
		if (
			isNodeRelevant(node.id) &&
			position !== undefined &&
			x >= position.x &&
			x <= position.x + position.width &&
			y >= position.y &&
			y <= position.y + position.height
		)
			return {
				id: node.id,
				kind: "node",
			};
	}
	const tolerance = 9 / zoom;
	for (const metroFirst of [
		true,
		false,
	]) {
		for (const edge of flow.edges) {
			if (!isEdgeRelevant(edge.id)) continue;
			const metroBackbone = metroBackbones.get(edge.id);
			if ((metroBackbone !== undefined) !== metroFirst) continue;
			const backbone = metroBackbone ?? backbones.get(edge.id);
			if (backbone !== undefined && distanceToRoute(x, y, backbone) <= tolerance)
				return {
					id: edge.id,
					kind: "edge",
				};
		}
	}
	return undefined;
};

interface CanvasPan {
	moved: boolean;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startViewport: Viewport;
}

const DefaultOriginFlowViewportZoom = readDefaultOriginFlowViewportFn().zoom;
const ClickThreshold = 5;
const VisitHistoryLimit = 32;

const pushVisitFn = (history: ReadonlyArray<string>, nodeId: string) =>
	history.at(-1) === nodeId
		? history
		: [
				...history,
				nodeId,
			].slice(-VisitHistoryLimit);

/** Owns pointer capture, panning, hit selection, and port-following for the flow canvas. */
export const useCanvasPointer = ({
	backbones,
	connectedPorts,
	flow,
	highlight,
	metroBackbones,
	nodeMetrics,
	onSelectionChange,
	onItemOpen,
	positions,
	resetNavigation,
	scheduleDraw,
	selection,
	viewportRef,
	visitHistoryRef,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly connectedPorts: ConnectedPorts;
	readonly flow: ItemOriginFlow;
	readonly highlight: Highlight | undefined;
	readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
	readonly onSelectionChange: (selection: Selection | undefined) => void;
	readonly onItemOpen: (itemId: string) => void;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly resetNavigation: () => void;
	readonly scheduleDraw: () => void;
	readonly selection: Selection | undefined;
	readonly viewportRef: RefObject<Viewport>;
	readonly visitHistoryRef: RefObject<ReadonlyArray<string>>;
}) => {
	const panRef = useRef<CanvasPan | undefined>(undefined);
	const readWorldPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const viewport = viewportRef.current;
		return {
			x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
			y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
		};
	};
	const readHit = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const point = readWorldPoint(event);
		return readHitFn({
			backbones,
			connectedPorts,
			flow,
			highlight,
			metroBackbones,
			nodeMetrics,
			positions,
			selection,
			x: point.x,
			y: point.y,
			zoom: viewportRef.current.zoom,
		});
	};
	const isOverNode = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const point = readWorldPoint(event);
		for (const [nodeId, position] of positions)
			if (
				(selection?.kind !== "node" || highlight?.nodeIds.has(nodeId) === true) &&
				point.x >= position.x &&
				point.x <= position.x + position.width &&
				point.y >= position.y &&
				point.y <= position.y + position.height
			)
				return true;
		return false;
	};

	const finishPan = (event: ReactPointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
		const pan = panRef.current;
		if (pan === undefined || pan.pointerId !== event.pointerId) return;
		panRef.current = undefined;
		event.currentTarget.style.cursor = isOverNode(event) ? "pointer" : "grab";
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (cancelled || pan.moved) return;

		const rect = event.currentTarget.getBoundingClientRect();
		const viewport = viewportRef.current;
		const hit = readHit(event);
		if (hit?.kind === "item-detail") {
			onItemOpen(hit.itemId);
			return;
		}
		if (hit?.kind === "port") {
			const targetPosition = positions.get(hit.targetNodeId);
			if (targetPosition === undefined) return;
			viewportRef.current = readOriginFlowNodeViewportFn(
				targetPosition,
				rect.width,
				rect.height,
				Math.max(viewport.zoom, DefaultOriginFlowViewportZoom),
			);
			resetNavigation();
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node") visitHistory = pushVisitFn(visitHistory, selection.id);
			visitHistoryRef.current = pushVisitFn(visitHistory, hit.targetNodeId);
			onSelectionChange({
				id: hit.targetNodeId,
				kind: "node",
			});
			scheduleDraw();
			return;
		}
		if (hit?.kind === "node") {
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node") visitHistory = pushVisitFn(visitHistory, selection.id);
			visitHistoryRef.current = pushVisitFn(visitHistory, hit.id);
		}
		if (
			hit !== undefined &&
			selection !== undefined &&
			hit.kind === selection.kind &&
			hit.id === selection.id
		)
			onSelectionChange(undefined);
		else onSelectionChange(hit);
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;
		panRef.current = {
			moved: false,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startViewport: viewportRef.current,
		};
		event.currentTarget.style.cursor = "grabbing";
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const pan = panRef.current;
		if (pan === undefined) {
			event.currentTarget.style.cursor = isOverNode(event) ? "pointer" : "grab";
			return;
		}
		if (pan.pointerId !== event.pointerId) return;
		const deltaX = event.clientX - pan.startClientX;
		const deltaY = event.clientY - pan.startClientY;
		if (Math.abs(deltaX) + Math.abs(deltaY) >= ClickThreshold) pan.moved = true;
		viewportRef.current = {
			x: pan.startViewport.x + deltaX,
			y: pan.startViewport.y + deltaY,
			zoom: pan.startViewport.zoom,
		};
		scheduleDraw();
	};

	return {
		handlePointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) =>
			finishPan(event, true),
		handlePointerDown,
		handlePointerMove,
		handlePointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => finishPan(event, false),
	};
};
