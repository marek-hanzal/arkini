// @vitest-environment jsdom

import React, { act, createElement, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TileDropIntent } from "~/ui/tile/TileDropIntent";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { useTile } from "~/ui/tile/useTile";
import { useTileSlot } from "~/ui/tile/useTileSlot";
import { useTileSurface } from "~/ui/tile/useTileSurface";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const capturedPointers = new WeakMap<HTMLElement, Set<number>>();

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height,
	x: left,
	y: top,
	toJSON: () => ({}),
});

const pointerEvent = (
	type: string,
	{
		x,
		y,
		pointerId = 1,
	}: {
		readonly x: number;
		readonly y: number;
		readonly pointerId?: number;
	},
) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: 0,
		cancelable: true,
		clientX: x,
		clientY: y,
	});
	Object.defineProperties(event, {
		isPrimary: {
			value: true,
		},
		pointerId: {
			value: pointerId,
		},
	});
	return event;
};

const boardSurface = {
	id: "board:0",
	kind: "board",
	space: 0,
} satisfies TileSurface;
const inventorySurface = {
	id: "inventory",
	kind: "inventory",
} satisfies TileSurface;
const toolbarSurface = {
	id: "toolbar",
	kind: "toolbar",
} satisfies TileSurface;
const sourceSlot = {
	id: "0:0",
	x: 0,
	y: 0,
} satisfies TileSlot;
const inventorySlot = {
	id: "1:0",
	x: 1,
	y: 0,
} satisfies TileSlot;
const toolbarSlot = {
	id: "2:0",
	x: 2,
	y: 0,
} satisfies TileSlot;
const toolbarOccupant = {
	id: "runtime:toolbar",
	revision: "revision:toolbar",
} satisfies TileIdentity;

const Surface = ({
	surface,
	slot,
	occupant = null,
	children,
}: {
	readonly surface: TileSurface;
	readonly slot: TileSlot;
	readonly occupant?: TileIdentity | null;
	readonly children?: React.ReactNode;
}) => {
	const surfaceRef = useTileSurface(surface);
	const drop = useTileSlot({
		surface,
		slot,
		occupant,
	});
	return createElement(
		"div",
		{
			ref: surfaceRef,
			"data-surface": surface.kind,
		},
		createElement(
			"div",
			{
				ref: drop.ref,
				"data-slot": `${surface.kind}:${slot.id}`,
				"data-over": drop.over ? "true" : "false",
			},
			children,
		),
	);
};

const HarnessContent = ({ onDrop }: { readonly onDrop: (intent: TileDropIntent) => void }) => {
	const source = useMemo(
		() => ({
			id: "runtime:source",
			revision: "revision:source",
			surface: boardSurface,
			slot: sourceSlot,
		}),
		[],
	);
	const tile = useTile({
		source,
		onDrop: (intent) => {
			onDrop(intent);
			return {
				kind: "accepted",
			};
		},
	});

	return createElement(
		React.Fragment,
		null,
		createElement(
			Surface,
			{
				surface: boardSurface,
				slot: sourceSlot,
			},
			createElement(
				"button",
				{
					ref: tile.ref,
					type: "button",
					"data-source-tile": "true",
					...tile.pointerProps,
				},
				"Source",
			),
		),
		createElement(Surface, {
			surface: inventorySurface,
			slot: inventorySlot,
		}),
		createElement(Surface, {
			surface: toolbarSurface,
			slot: toolbarSlot,
			occupant: toolbarOccupant,
		}),
	);
};

const Harness = ({ onDrop }: { readonly onDrop: (intent: TileDropIntent) => void }) =>
	createElement(
		TileSystemProvider,
		null,
		createElement(HarnessContent, {
			onDrop,
		}),
	);

beforeEach(() => {
	Object.defineProperty(window, "requestAnimationFrame", {
		configurable: true,
		value: vi.fn(() => 1),
	});
	Object.defineProperty(window, "cancelAnimationFrame", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
		configurable: true,
		value(pointerId: number) {
			const pointers = capturedPointers.get(this) ?? new Set<number>();
			pointers.add(pointerId);
			capturedPointers.set(this, pointers);
		},
	});
	Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
		configurable: true,
		value(pointerId: number) {
			return capturedPointers.get(this)?.has(pointerId) ?? false;
		},
	});
	Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
		configurable: true,
		value(pointerId: number) {
			capturedPointers.get(this)?.delete(pointerId);
		},
	});
	Object.defineProperty(HTMLElement.prototype, "animate", {
		configurable: true,
		value: vi.fn(() => ({
			cancel: vi.fn(),
			finished: Promise.resolve(),
		})),
	});
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const element = this as HTMLElement;
			if (element.dataset.sourceTile === "true") return rect(10, 10, 80, 80);
			if (element.dataset.surface === "board") return rect(0, 0, 100, 100);
			if (element.dataset.surface === "inventory") return rect(180, 0, 160, 120);
			if (element.dataset.surface === "toolbar") return rect(380, 0, 120, 100);
			if (element.dataset.slot?.startsWith("board:")) return rect(0, 0, 100, 100);
			if (element.dataset.slot?.startsWith("inventory:")) return rect(200, 20, 80, 80);
			if (element.dataset.slot?.startsWith("toolbar:")) return rect(400, 10, 80, 80);
			return rect(0, 0, 0, 0);
		},
	});
	Object.defineProperty(document, "elementsFromPoint", {
		configurable: true,
		value: vi.fn((x: number) => {
			if (x >= 200 && x < 280) {
				return [
					document.querySelector('[data-slot^="inventory:"]'),
				];
			}
			if (x >= 400 && x < 480) {
				return [
					document.querySelector('[data-slot^="toolbar:"]'),
				];
			}
			if (x >= 180 && x < 340) {
				return [
					document.querySelector('[data-surface="inventory"]'),
				];
			}
			if (x < 100)
				return [
					document.querySelector('[data-source-tile="true"]'),
				];
			return [];
		}),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderHarness = async (onDrop: (intent: TileDropIntent) => void) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Harness, {
				onDrop,
			}),
		);
	});
	const source = document.querySelector<HTMLElement>('[data-source-tile="true"]');
	if (source === null) throw new Error("Missing source tile.");
	return source;
};

const drag = async (source: HTMLElement, x: number, y: number) => {
	await act(async () => {
		source.dispatchEvent(
			pointerEvent("pointerdown", {
				x: 50,
				y: 50,
			}),
		);
		source.dispatchEvent(
			pointerEvent("pointermove", {
				x,
				y,
			}),
		);
		source.dispatchEvent(
			pointerEvent("pointerup", {
				x,
				y,
			}),
		);
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("TileSystemProvider", () => {
	it("reports a Board source dropped into one inventory slot", async () => {
		const onDrop = vi.fn();
		const source = await renderHarness(onDrop);

		await drag(source, 240, 50);

		expect(onDrop).toHaveBeenCalledWith({
			source: {
				id: "runtime:source",
				revision: "revision:source",
				surface: boardSurface,
				slot: sourceSlot,
			},
			target: {
				kind: "slot",
				surface: inventorySurface,
				slot: inventorySlot,
				occupant: null,
			},
			pointer: {
				x: 240,
				y: 50,
			},
		});
		expect(document.querySelector('[data-ui="TileDragGhost"]')).toBeNull();
		expect(source.style.visibility).toBe("");
	});

	it("preserves an occupied toolbar target as a logical drop fact", async () => {
		const onDrop = vi.fn();
		const source = await renderHarness(onDrop);

		await drag(source, 440, 50);

		expect(onDrop.mock.calls[0]?.[0]).toMatchObject({
			target: {
				kind: "slot",
				surface: toolbarSurface,
				slot: toolbarSlot,
				occupant: toolbarOccupant,
			},
		});
	});

	it("distinguishes a surface gap and an unrelated topmost overlay from a slot", async () => {
		const onDrop = vi.fn();
		const source = await renderHarness(onDrop);

		await drag(source, 300, 50);
		expect(onDrop.mock.calls[0]?.[0]).toMatchObject({
			target: {
				kind: "surface",
				surface: inventorySurface,
			},
		});

		const overlay = document.createElement("div");
		overlay.dataset.overlay = "true";
		document.body.append(overlay);
		vi.mocked(document.elementsFromPoint).mockReturnValue([
			overlay,
		]);
		await drag(source, 20, 20);
		expect(onDrop.mock.calls[1]?.[0]).toMatchObject({
			target: {
				kind: "outside",
			},
		});
	});
});
