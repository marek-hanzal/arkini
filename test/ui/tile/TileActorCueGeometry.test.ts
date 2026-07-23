// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TileSystem } from "~/ui/tile/TileSystemContext";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorCueGeometry } from "~/ui/tile/useTileActorCueGeometry";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const runtimeState = vi.hoisted(() => ({
	reducedMotion: false,
	system: null as TileSystem | null,
}));

vi.mock("motion/react", () => ({
	useReducedMotion: () => runtimeState.reducedMotion,
}));
vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => {
		if (runtimeState.system === null) throw new Error("Missing test Tile System.");
		return runtimeState.system;
	},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
let current: ReturnType<typeof useTileActorCueGeometry> | null = null;
let snapshots: Array<ReturnType<typeof useTileActorCueGeometry>> = [];

const placementSource: TileDragSource = {
	id: "runtime:target",
	revision: "revision:target",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 3,
			y: 2,
		},
	},
	surface: {
		id: "board:0",
		kind: "board",
		space: 0,
	},
	slot: {
		id: "3:2",
		x: 3,
		y: 2,
	},
};

const rect = (left: number, top: number, width = 80, height = 80): DOMRect => ({
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

const Capture = ({ cue }: { readonly cue: TileMotionCueSchema.Type | null }) => {
	current = useTileActorCueGeometry({
		itemId: "runtime:target",
		placementSource,
		cue,
	});
	snapshots.push(current);
	return null;
};

const renderGeometry = async (cue: TileMotionCueSchema.Type | null) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			createElement(Capture, {
				cue,
			}),
		),
	);
	return {
		rerender: async (nextCue: TileMotionCueSchema.Type | null) => {
			await act(async () =>
				root.render(
					createElement(Capture, {
						cue: nextCue,
					}),
				),
			);
		},
	};
};

beforeEach(() => {
	runtimeState.reducedMotion = false;
	runtimeState.system = null;
	current = null;
	snapshots = [];
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("useTileActorCueGeometry", () => {
	it("measures only the exact absorb origin geometry", async () => {
		const readActorLayerRect = vi.fn(() => rect(100, 50, 800, 600));
		const readActorRect = vi.fn((itemId: string) =>
			itemId === "runtime:origin" ? rect(180, 110) : null,
		);
		const readPlacement = vi.fn(() => ({
			x: 300,
			y: 200,
			width: 100,
			height: 100,
		}));
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect,
			readActorRect,
			readPlacement,
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 1,
			kind: "absorb",
			originItemId: "runtime:origin",
			deliveryQuantity: 1,
			strength: 1,
		});

		expect(current?.originOffset).toEqual({
			x: -230,
			y: -150,
		});
		expect(current?.targetOffset).toBeNull();
		expect(readActorRect).toHaveBeenCalledTimes(1);
		expect(readActorRect).toHaveBeenCalledWith("runtime:origin");
		expect(readPlacement).toHaveBeenCalledTimes(1);
		expect(readPlacement).toHaveBeenCalledWith(placementSource);
	});

	it("anchors collapse absorb output at the producer center, not its directional mouth", async () => {
		const readActorRect = vi.fn(() => rect(0, 0, 100, 100));
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect: vi.fn(() => rect(0, 0, 800, 600)),
			readActorRect,
			readPlacement: vi.fn(() => ({
				x: 200,
				y: 0,
				width: 100,
				height: 100,
			})),
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 11,
			kind: "absorb",
			originItemId: "runtime:origin",
			producerEmissionId: "emission:11",
			emissionFromCollapse: true,
			strength: 1,
		});

		expect(current?.originOffset).toEqual({
			x: -200,
			y: 0,
		});
	});

	it("measures consume travel between exact actor centers", async () => {
		const readActorRect = vi.fn((itemId: string) =>
			itemId === "runtime:target"
				? rect(100, 100)
				: itemId === "runtime:owner"
					? rect(300, 140)
					: null,
		);
		const readPlacement = vi.fn();
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect: vi.fn(),
			readActorRect,
			readPlacement,
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 2,
			kind: "consume",
			targetItemId: "runtime:owner",
			strength: 1,
		});

		expect(current?.targetOffset).toEqual({
			x: 200,
			y: 40,
		});
		expect(current?.originOffset).toBeNull();
		expect(readPlacement).not.toHaveBeenCalled();
	});

	it("measures a completed producer toward the centroid of its exact outputs", async () => {
		const readActorRect = vi.fn(() => rect(100, 100));
		const outputSources = new Map(
			[
				"runtime:output:a",
				"runtime:output:b",
			].map((itemId) => [
				itemId,
				{
					...placementSource,
					id: itemId,
				},
			]),
		);
		const readActorSource = vi.fn((itemId: string) => outputSources.get(itemId) ?? null);
		const readPlacement = vi.fn((source: TileDragSource) => {
			switch (source.id) {
				case "runtime:target":
					return {
						x: 100,
						y: 100,
						width: 80,
						height: 80,
					};
				case "runtime:output:a":
					return {
						x: 300,
						y: 100,
						width: 80,
						height: 80,
					};
				case "runtime:output:b":
					return {
						x: 500,
						y: 300,
						width: 80,
						height: 80,
					};
				default:
					return null;
			}
		});
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect: vi.fn(() => rect(0, 0, 800, 600)),
			readActorRect,
			readActorSource,
			readPlacement,
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 3,
			kind: "complete",
			emissionTargetItemIds: [
				"runtime:output:a",
				"runtime:output:b",
			],
			strength: 1,
		});

		expect(current?.targetOffset).toEqual({
			x: 300,
			y: 100,
		});
		expect(current?.originOffset).toBeNull();
		expect(readActorRect).not.toHaveBeenCalled();
		expect(readActorSource.mock.calls.map(([itemId]) => itemId)).toEqual([
			"runtime:output:a",
			"runtime:output:b",
		]);
	});

	it("performs no actor geometry work for unrelated cues", async () => {
		const readActorLayerRect = vi.fn();
		const readActorRect = vi.fn();
		const readPlacement = vi.fn();
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect,
			readActorRect,
			readPlacement,
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 3,
			kind: "impact",
			strength: 1,
		});

		expect(current).toEqual({
			originOffset: null,
			targetOffset: null,
		});
		expect(readActorLayerRect).not.toHaveBeenCalled();
		expect(readActorRect).not.toHaveBeenCalled();
		expect(readPlacement).not.toHaveBeenCalled();
	});

	it("skips missing and same-identity cue endpoints", async () => {
		const readActorLayerRect = vi.fn();
		const readActorRect = vi.fn();
		const readPlacement = vi.fn();
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect,
			readActorRect,
			readPlacement,
		} as unknown as TileSystem;
		const rendered = await renderGeometry({
			generation: 4,
			kind: "absorb",
			originItemId: "runtime:target",
			strength: 1,
		});
		await rendered.rerender({
			generation: 5,
			kind: "consume",
			targetItemId: "runtime:target",
			strength: 1,
		});
		await rendered.rerender({
			generation: 6,
			kind: "absorb",
			strength: 1,
		});

		expect(current).toEqual({
			originOffset: null,
			targetOffset: null,
		});
		expect(readActorLayerRect).not.toHaveBeenCalled();
		expect(readActorRect).not.toHaveBeenCalled();
		expect(readPlacement).not.toHaveBeenCalled();
	});

	it("never exposes generation N geometry while generation N+1 is current", async () => {
		let placementAvailable = true;
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => rect(0, 0, 800, 600),
			readActorRect: () => rect(0, 0),
			readPlacement: () =>
				placementAvailable
					? {
							x: 200,
							y: 0,
							width: 80,
							height: 80,
						}
					: null,
		} as unknown as TileSystem;
		const rendered = await renderGeometry({
			generation: 7,
			kind: "absorb",
			originItemId: "runtime:origin",
			strength: 1,
		});
		expect(current?.originOffset).toEqual({
			x: -200,
			y: 0,
		});

		placementAvailable = false;
		const nextGenerationSnapshot = snapshots.length;
		await rendered.rerender({
			generation: 8,
			kind: "absorb",
			originItemId: "runtime:origin",
			strength: 1,
		});

		expect(
			snapshots
				.slice(nextGenerationSnapshot)
				.every((snapshot) => snapshot.originOffset === null),
		).toBe(true);
	});

	it("degrades failed and reduced-motion geometry locally", async () => {
		const readActorRect = vi.fn(() => {
			throw new Error("measurement failed");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		runtimeState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => rect(0, 0),
			readActorRect,
			readPlacement: () => null,
		} as unknown as TileSystem;

		await renderGeometry({
			generation: 9,
			kind: "consume",
			targetItemId: "runtime:owner",
			strength: 1,
		});
		expect(current?.targetOffset).toBeNull();
		expect(consoleError).toHaveBeenCalledWith(
			"Tile cue geometry measurement failed; using local feedback only.",
			expect.any(Error),
		);

		runtimeState.reducedMotion = true;
		readActorRect.mockClear();
		await renderGeometry({
			generation: 10,
			kind: "absorb",
			originItemId: "runtime:origin",
			strength: 1,
		});
		expect(current?.originOffset).toBeNull();
		expect(readActorRect).not.toHaveBeenCalled();
	});
});
