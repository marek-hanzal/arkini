// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

const renderState = vi.hoisted(() => ({
	counts: new Map<string, number>(),
}));

vi.mock("~/bridge/item-detail/useStartItemDetailLine", () => ({
	useStartItemDetailLine: () => vi.fn(),
}));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		isOpen: false,
		openItemDetail: vi.fn(),
	}),
}));

vi.mock("~/ui/tile/TileActorContent", () => ({
	TileActorContent: ({ item }: { readonly item: useTileActors.Item }) => {
		renderState.counts.set(item.id, (renderState.counts.get(item.id) ?? 0) + 1);
		return null;
	},
}));

vi.mock("~/ui/tile/useTileActorPresentation", () => ({
	useTileActorPresentation: ({ item }: { readonly item: useTileActors.Item }) => {
		const surface = {
			id: "board:0",
			kind: "board" as const,
			space: 0,
		};
		const slot = {
			id: `${item.location.position.x}:${item.location.position.y}`,
			x: item.location.position.x,
			y: item.location.position.y,
		};
		const source = {
			id: item.id,
			revision: item.revision,
			location: item.location,
			surface,
			slot,
		};
		return {
			canonicalSource: source,
			desiredSource: source,
			phase: "stable" as const,
			feedback: null,
			forbiddenDrop: false,
			zIndex: 10,
			placementFrozen: false,
			positionCompletion: {
				kind: "none" as const,
			},
			visualCompletionGeneration: null,
			quantityOverride: null,
			hovered: false,
			setHovered: vi.fn(),
		};
	},
}));

vi.mock("~/ui/tile/useTileActorMotion", () => ({
	useTileActorMotion: () => ({
		placement: {
			visible: true,
			anchor: {
				x: 0,
				y: 0,
			},
			width: 80,
			height: 80,
		},
		neighbour: {
			values: {
				x: 0,
				y: 0,
				scale: 1,
			},
			registerActorNode: vi.fn(),
		},
		pointer: {
			commands: {},
			values: {
				direct: {
					x: 0,
					y: 0,
				},
				physical: {
					x: 0,
					y: 0,
					rotation: 0,
				},
				pickup: {
					x: 0,
					y: 0,
				},
			},
		},
		travel: {
			x: 0,
			y: 0,
			spawnDeliveryTiming: null,
			spawnDeliveryReady: true,
		},
		cueGeometry: {
			originOffset: null,
			targetOffset: null,
		},
		completion: {
			onVisualComplete: vi.fn(),
		},
	}),
}));

vi.mock("~/ui/tile/useTileActorDrag", () => ({
	useTileActorDrag: () => ({
		dragControls: null,
		consumeClickSuppression: () => false,
		onPointerDown: vi.fn(),
		onPointerUp: vi.fn(),
		onPointerCancel: vi.fn(),
		onDragStart: vi.fn(),
		onDrag: vi.fn(),
		onDragEnd: vi.fn(),
	}),
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (index: number): useTileActors.Item => ({
	id: `runtime:${index}`,
	revision: `revision:${index}`,
	itemId: `item:${index}`,
	title: `Item ${index}`,
	quantity: 1,
	sourceUrl: `resource:${index}`,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: index % 8,
			y: Math.floor(index / 8),
		},
	},
	running: false,
	primaryAction: {
		kind: "none",
	},
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	renderState.counts.clear();
	document.body.replaceChildren();
});

describe("TileActor render boundary", () => {
	it("keeps cue insertion, coalescing, completion, and item updates local in a dense actor list", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const items = Array.from(
			{
				length: 40,
			},
			(_, index) => item(index),
		);
		const onCueStart = vi.fn();
		const onCueContact = vi.fn();
		const onCueComplete = vi.fn();
		let cue: TileMotionCueSchema.Type | null = null;
		let live = true;

		const render = async (currentItems: ReadonlyArray<useTileActors.Item>) => {
			await act(async () => {
				root.render(
					createElement(
						"div",
						null,
						...currentItems.map((current) =>
							createElement(TileActor, {
								key: current.id,
								item: current,
								live: current.id === "runtime:7" ? live : true,
								cue: current.id === "runtime:7" ? cue : null,
								morphPreviousItem: null,
								onCueStart,
								onCueContact,
								onCueComplete,
							}),
						),
					),
				);
			});
		};
		const expectOnly = (itemId: string, renders: number) => {
			for (const current of items) {
				expect(renderState.counts.get(current.id), current.id).toBe(
					current.id === itemId ? renders : 1,
				);
			}
		};

		await render(items);
		expect(new Set(renderState.counts.values())).toEqual(
			new Set([
				1,
			]),
		);

		cue = {
			generation: 1,
			kind: "impact",
			strength: 1,
		};
		await render(items);
		expectOnly("runtime:7", 2);

		cue = {
			...cue,
			strength: 2,
		};
		await render(items);
		expectOnly("runtime:7", 3);

		cue = null;
		await render(items);
		expectOnly("runtime:7", 4);

		live = false;
		await render(items);
		expectOnly("runtime:7", 5);

		const updated = items.map((current) =>
			current.id === "runtime:12"
				? {
						...current,
						quantity: 2,
					}
				: current,
		);
		await render(updated);
		expect(renderState.counts.get("runtime:7")).toBe(5);
		expect(renderState.counts.get("runtime:12")).toBe(2);
		for (const current of items) {
			if (current.id === "runtime:7" || current.id === "runtime:12") continue;
			expect(renderState.counts.get(current.id), current.id).toBe(1);
		}
	});
});
