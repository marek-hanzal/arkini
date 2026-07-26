// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { PixiInventorySurface } from "~/ui/pixi/PixiInventorySurface";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const surfaceState = vi.hoisted(() => ({
	createProps: null as {
		readonly onActivate: (
			item: TileActorItem,
			shiftKey: boolean,
			origin: HTMLElement,
		) => void | PromiseLike<void>;
	} | null,
	detail: vi.fn(),
	interactionCancel: vi.fn(),
	interactionRegister: vi.fn(),
	interactionUnregister: vi.fn(),
	release: vi.fn(),
}));

const game = {
	config: {
		meta: {
			board: {
				height: 7,
				width: 11,
			},
			inventory: {
				height: 4,
				width: 5,
			},
			toolbarSize: 8,
		},
	},
	runFx: <Result, Error>(effect: Effect.Effect<Result, Error>) => effect,
} as GameEngine;

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => game,
}));

vi.mock("~/bridge/runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/engine/runtime/write/releaseInventoryItemFx", () => ({
	releaseInventoryItemFx: (props: unknown) =>
		Effect.sync(() => {
			surfaceState.release(props);
		}),
}));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		openItemDetailFx: (props: unknown) =>
			Effect.sync(() => {
				surfaceState.detail(props);
			}),
	}),
}));

vi.mock("~/ui/pixi/usePixiGameRuntime", () => ({
	usePixiGameRuntime: () => ({
		interaction: {
			registerFx: (cancel: () => void) =>
				Effect.sync(() => {
					surfaceState.interactionRegister(cancel);
					return surfaceState.interactionUnregister;
				}),
		},
		textures: {},
	}),
}));

vi.mock("~/ui/pixi/scene/createPixiInventorySceneRuntimeFx", () => ({
	createPixiInventorySceneRuntimeFx: (props: NonNullable<typeof surfaceState.createProps>) =>
		Effect.sync(() => {
			surfaceState.createProps = props;
			return {
				canvas: document.createElement("canvas"),
				cancelInteractionFx: Effect.sync(surfaceState.interactionCancel),
				closeFx: Effect.void,
			};
		}),
}));

const item = {
	id: "runtime:water",
	itemId: "water",
	location: {
		scope: "inventory",
		position: {
			x: 1,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 4,
	revision: "revision:water",
	running: false,
	runningGlow: false,
	sourceUrl: "resource:water",
	title: "Water",
} satisfies TileActorItem;

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderSurface = async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(PixiInventorySurface));
		await Promise.resolve();
	});
	const createProps = surfaceState.createProps;
	if (createProps === null) throw new Error("Inventory surface did not create its scene.");
	return createProps;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	surfaceState.createProps = null;
	surfaceState.detail.mockClear();
	surfaceState.interactionCancel.mockClear();
	surfaceState.interactionRegister.mockClear();
	surfaceState.interactionUnregister.mockClear();
	surfaceState.release.mockClear();
	document.body.replaceChildren();
});

describe("PixiInventorySurface", () => {
	it("hands an ordinary click to the exact Inventory release command", async () => {
		const props = await renderSurface();
		const canvas = document.createElement("canvas");

		await props.onActivate(item, false, canvas);

		expect(surfaceState.release).toHaveBeenCalledWith({
			itemId: item.id,
			location: item.location,
			revision: item.revision,
		});
		expect(surfaceState.detail).not.toHaveBeenCalled();
		expect(surfaceState.interactionRegister).toHaveBeenCalledOnce();
		const registeredCancel = surfaceState.interactionRegister.mock.calls[0]?.[0] as
			| (() => void)
			| undefined;
		if (registeredCancel === undefined) throw new Error("Interaction cancel is missing.");
		registeredCancel();
		expect(surfaceState.interactionCancel).toHaveBeenCalledOnce();
		const root = roots.pop();
		if (root === undefined) throw new Error("Inventory surface root is missing.");
		await act(async () => root.unmount());
		expect(surfaceState.interactionUnregister).toHaveBeenCalledOnce();
	});

	it("keeps Shift+click as Item Detail without releasing the item", async () => {
		const props = await renderSurface();
		const canvas = document.createElement("canvas");

		await props.onActivate(item, true, canvas);

		expect(surfaceState.detail).toHaveBeenCalledWith({
			itemId: item.id,
			origin: canvas,
		});
		expect(surfaceState.release).not.toHaveBeenCalled();
	});
});
