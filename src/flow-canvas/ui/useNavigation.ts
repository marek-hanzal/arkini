import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import {
	readDefaultOriginFlowViewportFn,
	readOriginFlowInitialFocusFn,
	readOriginFlowNodeViewportFn,
} from "~/flow-canvas/fn/readOriginFlowViewportFn";
import type { LayoutNode } from "~/flow-layout/type/Layout";
import type { Viewport } from "~/flow-canvas/type/Viewport";
import type { OriginFlowDirection, Selection } from "~/flow-canvas/type/Highlight";
import { type HighlightDepth, DefaultHighlightDepth } from "~/flow-canvas/ui/useProjection";

const DefaultOriginFlowViewportZoom = readDefaultOriginFlowViewportFn().zoom;

type FlowNavigationShortcut =
	| "back"
	| "depth-less"
	| "depth-more"
	| "depth-reset"
	| "help"
	| "home"
	| "inputs"
	| "next"
	| "outputs"
	| "previous"
	| "roots";

const popVisitFn = (history: ReadonlyArray<string>) => {
	if (history.length < 2)
		return {
			history,
			nodeId: undefined,
		};
	const nextHistory = history.slice(0, -1);
	return {
		history: nextHistory,
		nodeId: nextHistory.at(-1),
	};
};

const readShortcutFn = (event: KeyboardEvent): FlowNavigationShortcut | undefined => {
	const target = event.target;
	if (
		event.repeat ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		(target instanceof HTMLElement &&
			(target.isContentEditable ||
				[
					"INPUT",
					"SELECT",
					"TEXTAREA",
				].includes(target.tagName)))
	)
		return undefined;
	switch (event.key.toLowerCase()) {
		case "k":
			return "depth-less";
		case "l":
			return "depth-more";
		case "0":
			return "depth-reset";
		case "n":
			return "next";
		case "p":
			return "previous";
		case "h":
			return "home";
		case "i":
			return "inputs";
		case "o":
			return "outputs";
		case "s":
			return "roots";
		case "z":
			return "back";
		case "?":
			return "help";
	}
};

/** Owns flow keyboard cursors, visit history, help visibility, and viewport focus changes. */
export const useNavigation = ({
	canvasRef,
	direction,
	flow,
	inputNodeIds,
	maxHighlightLevel,
	navigationNodeIds,
	onSelectionChangeFn,
	outputNodeIds,
	positions,
	relationFocusNodeIdRef,
	rootNodeIds,
	scheduleDrawFn,
	selection,
	setHighlightDepthFn,
	viewportRef,
}: {
	readonly canvasRef: RefObject<HTMLCanvasElement | null>;
	readonly direction: OriginFlowDirection;
	readonly flow: ItemOriginFlow;
	readonly inputNodeIds: ReadonlyArray<string>;
	readonly maxHighlightLevel: number;
	readonly navigationNodeIds: ReadonlyArray<string>;
	readonly onSelectionChangeFn: (selection: Selection | undefined) => void;
	readonly outputNodeIds: ReadonlyArray<string>;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly relationFocusNodeIdRef: RefObject<string | undefined>;
	readonly rootNodeIds: ReadonlyArray<string>;
	readonly scheduleDrawFn: () => void;
	readonly selection: Selection | undefined;
	readonly setHighlightDepthFn: (
		value:
			| HighlightDepth
			| undefined
			| ((current: HighlightDepth | undefined) => HighlightDepth | undefined),
	) => void;
	readonly viewportRef: RefObject<Viewport>;
}) => {
	const navigationIndexRef = useRef(0);
	const inputIndexRef = useRef(-1);
	const outputIndexRef = useRef(-1);
	const rootIndexRef = useRef(-1);
	const visitHistoryRef = useRef<ReadonlyArray<string>>([]);
	const [helpOpen, setHelpOpenFn] = useState(false);
	const resetNavigationFn = useCallback(() => {
		navigationIndexRef.current = 0;
	}, []);

	const focusPositionFn = (position: LayoutNode, zoom: number) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (rect === undefined) return false;
		viewportRef.current = readOriginFlowNodeViewportFn(position, rect.width, rect.height, zoom);
		scheduleDrawFn();
		return true;
	};

	useEffect(() => {
		navigationIndexRef.current = 0;
	}, [
		navigationNodeIds,
	]);
	useEffect(() => {
		inputIndexRef.current = -1;
	}, [
		inputNodeIds,
	]);
	useEffect(() => {
		outputIndexRef.current = -1;
	}, [
		outputNodeIds,
	]);
	useEffect(() => {
		rootIndexRef.current = -1;
	}, [
		rootNodeIds,
	]);
	useEffect(() => {
		relationFocusNodeIdRef.current = undefined;
	}, [
		direction,
		selection,
	]);
	useEffect(() => {
		visitHistoryRef.current = [];
	}, [
		flow,
	]);

	useEffect(() => {
		const handleKeyDownFn = (event: KeyboardEvent) => {
			if (helpOpen) {
				if (event.key === "Escape" || event.key === "?") {
					event.preventDefault();
					setHelpOpenFn(false);
				}
				return;
			}
			const shortcut = readShortcutFn(event);
			if (shortcut === undefined) return;
			event.preventDefault();
			const focusNodeFn = (
				nodeId: string | undefined,
				indexRef?: {
					current: number;
				},
				index?: number,
			) => {
				if (nodeId === undefined) return false;
				const position = positions.get(nodeId);
				if (position === undefined) return false;
				relationFocusNodeIdRef.current = nodeId;
				const focused = focusPositionFn(
					position,
					Math.max(viewportRef.current.zoom, DefaultOriginFlowViewportZoom),
				);
				if (focused && indexRef !== undefined && index !== undefined)
					indexRef.current = index;
				return focused;
			};
			if (shortcut === "help") {
				setHelpOpenFn(true);
				return;
			}
			if (shortcut.startsWith("depth-")) {
				if (selection?.kind !== "node") return;
				relationFocusNodeIdRef.current = undefined;
				if (shortcut === "depth-reset") {
					setHighlightDepthFn(undefined);
					focusNodeFn(selection.id, navigationIndexRef, 0);
					return;
				}
				setHighlightDepthFn((current) => {
					const limit =
						current?.nodeId === selection.id && current.direction === direction
							? current.limit
							: Math.min(DefaultHighlightDepth, maxHighlightLevel);
					return {
						direction,
						limit:
							shortcut === "depth-less"
								? Math.max(0, limit - 1)
								: Math.min(maxHighlightLevel, limit + 1),
						nodeId: selection.id,
					};
				});
				return;
			}
			if (shortcut === "back") {
				const back = popVisitFn(visitHistoryRef.current);
				if (back.nodeId === undefined || !focusNodeFn(back.nodeId)) return;
				visitHistoryRef.current = back.history;
				onSelectionChangeFn({
					id: back.nodeId,
					kind: "node",
				});
				return;
			}
			if (shortcut === "home") {
				relationFocusNodeIdRef.current = undefined;
				const position =
					positions.get(navigationNodeIds[0] ?? "") ??
					readOriginFlowInitialFocusFn(flow, positions);
				if (
					position !== undefined &&
					focusPositionFn(
						position,
						Math.max(viewportRef.current.zoom, DefaultOriginFlowViewportZoom),
					)
				)
					navigationIndexRef.current = 0;
				return;
			}
			if (shortcut === "inputs" || shortcut === "outputs") {
				const ids = shortcut === "inputs" ? inputNodeIds : outputNodeIds;
				const indexRef = shortcut === "inputs" ? inputIndexRef : outputIndexRef;
				if (ids.length === 0) return;
				const index = (indexRef.current + 1) % ids.length;
				focusNodeFn(ids[index], indexRef, index);
				return;
			}
			if (shortcut === "roots") {
				if (selection?.kind !== "node" || rootNodeIds.length === 0) return;
				setHighlightDepthFn({
					direction,
					limit: maxHighlightLevel,
					nodeId: selection.id,
				});
				const index = (rootIndexRef.current + 1) % rootNodeIds.length;
				focusNodeFn(rootNodeIds[index], rootIndexRef, index);
				return;
			}
			relationFocusNodeIdRef.current = undefined;
			if (navigationNodeIds.length === 0) return;
			const offset = shortcut === "next" ? 1 : -1;
			const index =
				(navigationIndexRef.current + offset + navigationNodeIds.length) %
				navigationNodeIds.length;
			focusNodeFn(navigationNodeIds[index], navigationIndexRef, index);
		};
		window.addEventListener("keydown", handleKeyDownFn);
		return () => window.removeEventListener("keydown", handleKeyDownFn);
	}, [
		direction,
		flow,
		helpOpen,
		inputNodeIds,
		maxHighlightLevel,
		navigationNodeIds,
		onSelectionChangeFn,
		outputNodeIds,
		positions,
		rootNodeIds,
		scheduleDrawFn,
		selection,
		setHighlightDepthFn,
	]);

	return {
		helpOpen,
		resetNavigationFn,
		setHelpOpenFn,
		visitHistoryRef,
	};
};
