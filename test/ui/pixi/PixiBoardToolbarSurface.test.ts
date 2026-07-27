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
	openItemDetail: vi.fn(),
	registerInteraction: vi.fn(),
	runStartLine: vi.fn(),
	startLineState: {
		kind: "idle",
	} as
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "error";
				readonly autofilled: boolean;
				readonly error: unknown;
				readonly ownerItemId: string;
		  },
	unregisterInteraction: vi.fn(),
}));

vi.mock("@effect/atom-react", () => ({
	useAtom: () => [
		boardState.startLineState,
		boardState.runStartLine,
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
		openItemDetailFx: (props: unknown) =>
			Effect.sync(() => {
				boardState.openItemDetail(props);
			}),
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
	boardState.openItemDetail.mockClear();
	boardState.registerInteraction.mockClear();
	boardState.runStartLine.mockClear();
	boardState.startLineState = {
		kind: "idle",
	};
	boardState.unregisterInteraction.mockClear();
	document.body.replaceChildren();
});

describe("PixiBoardToolbarSurface", () => {
	it("silently resets a failed primary action without opening Item Detail", async () => {
		boardState.startLineState = {
			kind: "error",
			autofilled: false,
			error: {
				_tag: "DepositUnavailable",
			},
			ownerItemId: "runtime:producer",
		};
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);

		await act(async () => {
			root.render(createElement(PixiBoardToolbarSurface));
			await Promise.resolve();
		});

		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.runStartLine).toHaveBeenCalledWith({
			kind: "reset",
		});
	});

	it("keeps an unavailable left click inert and reserves Item Detail for right click", async () => {
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
		const owner = {
			id: "runtime:producer",
			itemId: "producer",
			itemType: "producer",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			primaryAction: {
				kind: "none",
			},
			quantity: 1,
			revision: "revision:producer",
			running: false,
			runningGlow: false,
			sourceUrl: "resource:producer",
			title: "Producer",
		} satisfies TileActorItem;
		const canvas = document.createElement("canvas");

		await createProps.onActivate(owner, false, canvas);

		expect(boardState.runStartLine).not.toHaveBeenCalled();
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.navigate).not.toHaveBeenCalled();

		await createProps.onActivate(owner, true, canvas);

		expect(boardState.openItemDetail).toHaveBeenCalledWith({
			itemId: owner.id,
			origin: canvas,
		});
		expect(boardState.runStartLine).not.toHaveBeenCalled();
	});

	it("sends another default-line command for a running owner and lets the engine enqueue or reject it", async () => {
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
		const producer = {
			id: "runtime:producer",
			itemId: "producer",
			itemType: "producer",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			primaryAction: {
				kind: "start-default-line",
				lineId: "line:default",
			},
			quantity: 1,
			revision: "revision:producer:running",
			running: true,
			runningGlow: true,
			sourceUrl: "resource:producer",
			title: "Producer",
		} satisfies TileActorItem;

		await createProps.onActivate(producer, false, document.createElement("canvas"));

		expect(boardState.runStartLine).toHaveBeenCalledWith({
			kind: "start",
			lineId: "line:default",
			ownerItemId: producer.id,
		});
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
	});

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
			itemType: "inventory",
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
