// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";

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
		openItemDetailFx: vi.fn(() => Effect.succeed(true)),
	}),
}));

vi.mock("~/ui/tile/TileActorContent", () => ({
	TileActorContent: ({ item }: { readonly item: useTileActors.Item }) => {
		renderState.counts.set(item.id, (renderState.counts.get(item.id) ?? 0) + 1);
		return null;
	},
}));

vi.mock("~/ui/tile/useTileActorPresentation", () => ({
	useTileActorPresentation: ({ item }: { readonly item: useTileActors.Item }) => ({
		canonicalSource: {
			id: item.id,
			revision: item.revision,
			location: item.location,
			surface: {
				id: "board:0",
				kind: "board" as const,
				space: 0,
			},
			slot: {
				id: `${item.location.position.x}:${item.location.position.y}`,
				x: item.location.position.x,
				y: item.location.position.y,
			},
		},
		phase: "stable" as const,
		feedback: null,
		forbiddenDrop: false,
		zIndex: 10,
	}),
}));

vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => ({
		geometryVersion: 0,
		readPlacement: () => ({
			x: 0,
			y: 0,
			width: 80,
			height: 80,
		}),
	}),
}));

vi.mock("~/ui/tile/useTileActorDrag", () => ({
	useTileActorDrag: () => ({
		dragControls: null,
		x: 0,
		y: 0,
		consumeClickSuppression: () => false,
		onPointerDown: vi.fn(),
		onPointerUp: vi.fn(),
		onPointerCancel: vi.fn(),
		onDragStart: vi.fn(),
		onDrag: vi.fn(),
		onDragEnd: vi.fn(),
	}),
}));

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
	it("keeps one canonical item update local in a dense actor list", async () => {
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
							}),
						),
					),
				);
			});
		};

		await render(items);
		await render(items);
		expect(new Set(renderState.counts.values())).toEqual(
			new Set([
				1,
			]),
		);

		const updated = items.map((current) =>
			current.id === "runtime:12"
				? {
						...current,
						quantity: 2,
					}
				: current,
		);
		await render(updated);

		expect(renderState.counts.get("runtime:12")).toBe(2);
		for (const current of items) {
			if (current.id === "runtime:12") continue;
			expect(renderState.counts.get(current.id), current.id).toBe(1);
		}
	});
});
