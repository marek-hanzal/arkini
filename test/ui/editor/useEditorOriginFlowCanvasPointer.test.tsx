// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import type { EditorItemOriginFlowLayoutNode } from "~/ui/item/editor/editorItemOriginFlowLayout";
import type {
	EditorOriginFlowHighlight,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowNodeMetricsFx } from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";
import { useEditorOriginFlowCanvasPointer } from "~/ui/item/editor/useEditorOriginFlowCanvasPointer";

const item: EditorItemOriginItemNode = {
	id: "item:flour",
	itemId: "item:flour",
	operations: [],
	resourceIds: [
		"asset:flour",
	],
	starterScopes: [],
	title: "Flour",
	type: "simple",
};
const flow: EditorItemOriginFlow = {
	edges: [],
	nodes: [
		item,
	],
};
const metrics = Effect.runSync(readEditorOriginFlowNodeMetricsFx(item));
const position: EditorItemOriginFlowLayoutNode = {
	flowOrder: 0,
	height: metrics.height,
	width: metrics.width,
	x: 100,
	y: 200,
};

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
	for (const root of roots.splice(0)) root.unmount();
	document.body.replaceChildren();
});

const pointerEvent = (type: string, clientX: number, clientY: number) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: 0,
		clientX,
		clientY,
	});
	Object.defineProperty(event, "pointerId", {
		value: 1,
	});
	return event;
};

const mountHarness = ({
	highlight,
	onItemOpen = vi.fn(),
	onSelectionChange = vi.fn(),
	selection,
}: {
	readonly highlight?: EditorOriginFlowHighlight;
	readonly onItemOpen?: (itemId: string) => void;
	readonly onSelectionChange?: (selection: unknown) => void;
	readonly selection?: EditorOriginFlowSelection;
} = {}) => {
	const Harness = () => {
		const handlers = useEditorOriginFlowCanvasPointer({
			backbones: new Map(),
			connectedPorts: new Map(),
			flow,
			highlight,
			metroBackbones: new Map(),
			nodeMetrics: new Map([
				[
					item.id,
					metrics,
				],
			]),
			onItemOpen,
			onSelectionChange,
			positions: new Map([
				[
					item.id,
					position,
				],
			]),
			resetNavigation: vi.fn(),
			scheduleDraw: vi.fn(),
			selection,
			viewportRef: useRef({
				x: 0,
				y: 0,
				zoom: 1,
			}),
			visitHistoryRef: useRef<ReadonlyArray<string>>([]),
		});
		return createElement("canvas", {
			onPointerDown: handlers.handlePointerDown,
			onPointerMove: handlers.handlePointerMove,
			onPointerUp: handlers.handlePointerUp,
		});
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	act(() => root.render(createElement(Harness)));
	const canvas = container.querySelector("canvas")!;
	canvas.getBoundingClientRect = () =>
		({
			bottom: 1000,
			height: 1000,
			left: 0,
			right: 1000,
			top: 0,
			width: 1000,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;
	canvas.setPointerCapture = vi.fn();
	canvas.hasPointerCapture = () => true;
	canvas.releasePointerCapture = vi.fn();
	return canvas;
};

describe("useEditorOriginFlowCanvasPointer", () => {
	it("opens an item when its rendered identity is clicked", () => {
		const onItemOpen = vi.fn();
		const canvas = mountHarness({
			onItemOpen,
		});
		const x = position.x + metrics.itemTextBounds.x + 1;
		const y = position.y + metrics.itemTextBounds.y + 1;

		act(() => {
			canvas.dispatchEvent(pointerEvent("pointermove", x, y));
		});
		expect(canvas.style.cursor).toBe("pointer");
		act(() => {
			canvas.dispatchEvent(pointerEvent("pointerdown", x, y));
		});
		expect(canvas.style.cursor).toBe("grabbing");
		act(() => {
			canvas.dispatchEvent(pointerEvent("pointerup", x, y));
		});

		expect(canvas.style.cursor).toBe("pointer");
		expect(onItemOpen).toHaveBeenCalledExactlyOnceWith(item.itemId);
	});

	it("uses a pointer over nodes without running click selection", () => {
		const onSelectionChange = vi.fn();
		const canvas = mountHarness({
			onSelectionChange,
		});

		act(() => {
			canvas.dispatchEvent(pointerEvent("pointermove", position.x + 1, position.y + 1));
		});
		expect(canvas.style.cursor).toBe("pointer");
		act(() => {
			canvas.dispatchEvent(pointerEvent("pointermove", 1, 1));
		});
		expect(canvas.style.cursor).toBe("grab");
		expect(onSelectionChange).not.toHaveBeenCalled();
	});

	it("keeps dimmed nodes outside the active highlight non-interactive", () => {
		const canvas = mountHarness({
			highlight: {
				edgeIds: new Set(),
				edgeLevels: new Map(),
				nodeIds: new Set(),
				nodeLevels: new Map(),
			},
			selection: {
				id: "item:selected",
				kind: "node",
			},
		});

		act(() => {
			canvas.dispatchEvent(pointerEvent("pointermove", position.x + 1, position.y + 1));
		});
		expect(canvas.style.cursor).toBe("grab");
	});
});
