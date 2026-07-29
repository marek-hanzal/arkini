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
	runDrop: vi.fn(),
	splitStack: vi.fn(() => Promise.resolve(true)),
	registerInteraction: vi.fn(),
	enqueueLine: vi.fn(),
	enqueueLineState: {
		kind: "idle",
	} as
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
				readonly ownerItemId: string;
		  },
	unregisterInteraction: vi.fn(),
}));

const tileAtoms = vi.hoisted(() => ({
	drop: {
		kind: "drop",
	},
	split: {
		kind: "split",
	},
}));

vi.mock("@effect/atom-react", () => ({
	useAtom: () => [
		boardState.enqueueLineState,
		boardState.enqueueLine,
	],
	useAtomSet: (atom: unknown) =>
		atom === tileAtoms.split ? boardState.splitStack : boardState.runDrop,
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
	runTileDropAtom: () => tileAtoms.drop,
}));

vi.mock("~/bridge/tile/runTileSplitAtom", () => ({
	runTileSplitAtom: () => tileAtoms.split,
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
	boardState.runDrop.mockClear();
	boardState.splitStack.mockClear();
	boardState.registerInteraction.mockClear();
	boardState.enqueueLine.mockClear();
	boardState.enqueueLineState = {
		kind: "idle",
	};
	boardState.unregisterInteraction.mockClear();
	document.body.replaceChildren();
});

describe("PixiBoardToolbarSurface", () => {
	it("silently resets a failed primary action without opening Item Detail", async () => {
		boardState.enqueueLineState = {
			kind: "error",
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
		expect(boardState.enqueueLine).toHaveBeenCalledWith({
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
			activityEffect: false,
			sourceUrl: "resource:producer",
			title: "Producer",
		} satisfies TileActorItem;
		const canvas = document.createElement("canvas");

		await createProps.onActivate(owner, "primary", canvas);

		expect(boardState.enqueueLine).not.toHaveBeenCalled();
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.navigate).not.toHaveBeenCalled();

		await createProps.onActivate(owner, "detail", canvas);

		expect(boardState.openItemDetail).toHaveBeenCalledWith({
			itemId: owner.id,
			origin: canvas,
		});
		expect(boardState.enqueueLine).not.toHaveBeenCalled();
	});

	it("submits an exact Board-stack split without invoking the tile primary action", async () => {
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
		const stack = {
			id: "runtime:stack",
			itemId: "material",
			itemType: "simple",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 1,
				},
			},
			primaryAction: {
				kind: "open-inventory",
			},
			quantity: 5,
			revision: "revision:stack",
			running: false,
			activityEffect: false,
			sourceUrl: "resource:material",
			title: "Material",
		} satisfies TileActorItem;

		await createProps.onActivate(stack, "split-stack", document.createElement("canvas"));

		expect(boardState.splitStack).toHaveBeenCalledWith({
			itemId: stack.id,
			location: stack.location,
			revision: stack.revision,
		});
		expect(boardState.navigate).not.toHaveBeenCalled();
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
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
				kind: "enqueue-default-line",
				lineId: "line:default",
			},
			quantity: 1,
			revision: "revision:producer:running",
			running: true,
			activityEffect: true,
			sourceUrl: "resource:producer",
			title: "Producer",
		} satisfies TileActorItem;

		await createProps.onActivate(producer, "primary", document.createElement("canvas"));

		expect(boardState.enqueueLine).toHaveBeenCalledWith({
			kind: "enqueue",
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
			activityEffect: false,
			sourceUrl: "resource:inventory",
			title: "Inventory",
		} satisfies TileActorItem;

		await createProps.onActivate(item, "primary", document.createElement("canvas"));

		expect(boardState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/inventory",
			params: {
				packageId: "package-board",
			},
		});
		expect(boardState.registerInteraction).toHaveBeenCalledOnce();
	});

	it("opens Inventory with an unmodified i key while the Board is idle", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);
		await act(async () => {
			root.render(createElement(PixiBoardToolbarSurface));
			await Promise.resolve();
		});
		const event = new KeyboardEvent("keydown", {
			cancelable: true,
			key: "i",
		});

		await act(async () => {
			window.dispatchEvent(event);
			await Promise.resolve();
		});

		expect(event.defaultPrevented).toBe(true);
		expect(boardState.navigate).toHaveBeenCalledOnce();
		expect(boardState.navigate).toHaveBeenCalledWith({
			to: "/game/$packageId/inventory",
			params: {
				packageId: "package-board",
			},
		});
	});

	it("does not hijack modified, repeated, or editable i key input", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		roots.push(root);
		await act(async () => {
			root.render(createElement(PixiBoardToolbarSurface));
			await Promise.resolve();
		});
		const input = document.createElement("input");
		document.body.append(input);

		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					ctrlKey: true,
					key: "i",
				}),
			);
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "i",
					repeat: true,
				}),
			);
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					bubbles: true,
					key: "i",
				}),
			);
			await Promise.resolve();
		});

		expect(boardState.navigate).not.toHaveBeenCalled();
	});
});
