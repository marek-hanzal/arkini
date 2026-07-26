// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { PixiBoardToolbarSurface } from "~/ui/pixi/PixiBoardToolbarSurface";
import type { createPixiMainSceneRuntimeFx } from "~/ui/pixi/scene/createPixiMainSceneRuntimeFx";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const boardState = vi.hoisted(() => ({
	close: vi.fn(),
	createProps: null as createPixiMainSceneRuntimeFx.Props | null,
	navigate: vi.fn(() => Promise.resolve()),
	registerInteraction: vi.fn(),
	unregisterInteraction: vi.fn(),
}));

vi.mock("@effect/atom-react", () => ({
	useAtom: () => [
		{
			kind: "idle",
		},
		vi.fn(),
	],
	useAtomSet: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => boardState.navigate,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => ({
		arkpack: {
			packageId: "package-board",
		},
	}),
}));

vi.mock("~/bridge/runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/bridge/tile/TileDefaultLineCommandAtom", () => ({
	TileDefaultLineCommandAtom: () => ({}),
}));

vi.mock("~/bridge/tile/runTileDropAtom", () => ({
	runTileDropAtom: () => ({}),
}));

vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		isOpen: false,
	}),
}));

vi.mock("~/ui/item-detail/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		isOpen: false,
		openItemDetailFx: () => Effect.void,
	}),
}));

vi.mock("~/ui/pixi/usePixiGameRuntime", () => ({
	usePixiGameRuntime: () => ({
		handoffs: {},
		interaction: {
			registerFx: (cancel: () => void) =>
				Effect.sync(() => {
					boardState.registerInteraction(cancel);
					return boardState.unregisterInteraction;
				}),
		},
		textures: {},
	}),
}));

vi.mock("~/ui/pixi/scene/createPixiMainSceneRuntimeFx", () => ({
	createPixiMainSceneRuntimeFx: (props: createPixiMainSceneRuntimeFx.Props) =>
		Effect.sync(() => {
			boardState.createProps = props;
			return {
				canvas: document.createElement("canvas"),
				cancelInteractionFx: Effect.void,
				closeFx: Effect.sync(boardState.close),
				setInteractionBlockedFx: () => Effect.void,
			};
		}),
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
		await Promise.resolve();
	});
	boardState.close.mockClear();
	boardState.createProps = null;
	boardState.navigate.mockClear();
	boardState.registerInteraction.mockClear();
	boardState.unregisterInteraction.mockClear();
	document.body.replaceChildren();
});

describe("PixiBoardToolbarSurface", () => {
	it("routes the open-inventory primary action to the sibling Inventory leaf", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);
		await act(async () => {
			root.render(createElement(PixiBoardToolbarSurface));
			await Promise.resolve();
		});
		const createProps = boardState.createProps;
		if (createProps === null) throw new Error("Board scene did not create its runtime.");
		const item = {
			id: "runtime:inventory",
			itemId: "inventory",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			primaryAction: {
				kind: "open-inventory",
			},
			quantity: 1,
			revision: "revision:inventory",
			running: false,
			runningGlow: false,
			sourceUrl: "resource:inventory",
			title: "Inventory",
		} satisfies TileActorItem;

		await createProps.onActivate(item, false, document.createElement("canvas"));

		expect(boardState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/inventory",
			params: {
				packageId: "package-board",
			},
		});
		expect(boardState.registerInteraction).toHaveBeenCalledOnce();
	});
});
