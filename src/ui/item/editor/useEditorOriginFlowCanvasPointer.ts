import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import {
	createEditorOriginFlowViewportFx,
	type EditorOriginFlowViewport,
} from "~/ui/item/editor/createEditorOriginFlowViewportFx";
import type {
	EditorOriginFlowHighlight,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import type { EditorOriginFlowConnectedPorts } from "~/ui/item/editor/readEditorOriginFlowConnectedPortsFx";
import { readEditorOriginFlowHitFx } from "~/ui/item/editor/readEditorOriginFlowHitFx";
import type { EditorOriginFlowNodeMetrics } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";
import { pushEditorOriginFlowVisitFx } from "~/ui/item/editor/pushEditorOriginFlowVisitFx";

interface EditorOriginFlowCanvasPan {
	moved: boolean;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startViewport: EditorOriginFlowViewport;
}

const FlowViewport = RendererRuntime.runSync(createEditorOriginFlowViewportFx());
const ClickThreshold = 5;

/** Owns pointer capture, panning, hit selection, and port-following for the flow canvas. */
export const useEditorOriginFlowCanvasPointer = ({
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
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly connectedPorts: EditorOriginFlowConnectedPorts;
	readonly flow: EditorItemOriginFlow;
	readonly highlight: EditorOriginFlowHighlight | undefined;
	readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly nodeMetrics: ReadonlyMap<string, EditorOriginFlowNodeMetrics>;
	readonly onSelectionChange: (selection: EditorOriginFlowSelection | undefined) => void;
	readonly onItemOpen: (itemId: string) => void;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly resetNavigation: () => void;
	readonly scheduleDraw: () => void;
	readonly selection: EditorOriginFlowSelection | undefined;
	readonly viewportRef: RefObject<EditorOriginFlowViewport>;
	readonly visitHistoryRef: RefObject<ReadonlyArray<string>>;
}) => {
	const panRef = useRef<EditorOriginFlowCanvasPan | undefined>(undefined);
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
		return RendererRuntime.runSync(
			readEditorOriginFlowHitFx({
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
			}),
		);
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
			viewportRef.current = FlowViewport.readNode(
				targetPosition,
				rect.width,
				rect.height,
				Math.max(viewport.zoom, FlowViewport.defaultViewport.zoom),
			);
			resetNavigation();
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = RendererRuntime.runSync(
					pushEditorOriginFlowVisitFx(visitHistory, selection.id),
				);
			visitHistoryRef.current = RendererRuntime.runSync(
				pushEditorOriginFlowVisitFx(visitHistory, hit.targetNodeId),
			);
			onSelectionChange({
				id: hit.targetNodeId,
				kind: "node",
			});
			scheduleDraw();
			return;
		}
		if (hit?.kind === "node") {
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = RendererRuntime.runSync(
					pushEditorOriginFlowVisitFx(visitHistory, selection.id),
				);
			visitHistoryRef.current = RendererRuntime.runSync(
				pushEditorOriginFlowVisitFx(visitHistory, hit.id),
			);
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
