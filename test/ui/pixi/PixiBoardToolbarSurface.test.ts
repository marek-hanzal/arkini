// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { PixiBoardToolbarSurface } from "~/ui/pixi/PixiBoardToolbarSurface";
import type { createMainRuntimeFx } from "~/ui/pixi/scene/createMainRuntimeFx";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const boardState = vi.hoisted(() => ({
	close: vi.fn(),
	createProps: null as createMainRuntimeFx.Props | null,
	navigate: vi.fn(() => Promise.resolve()),
	openItemDetail: vi.fn(),
	runDrop: vi.fn(),
	runSpaceActivation: vi.fn(() => Promise.resolve(true)),
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
	space: {
		kind: "space",
	},
}));

vi.mock("@effect/atom-react", () => ({
	useAtom: () => [
		boardState.enqueueLineState,
		boardState.enqueueLine,
	],
	useAtomSet: (atom: unknown) =>
		atom === tileAtoms.split
			? boardState.splitStack
			: atom === tileAtoms.space
				? boardState.runSpaceActivation
				: boardState.runDrop,
}));

vi.mock("~/ui/game/useGameEngine", () => ({
	useGameEngine: () => ({}),
}));

vi.mock("~/application-runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/ui/pixi/command/TileDefaultLineCommandAtom", () => ({
	TileDefaultLineCommandAtom: () => ({}),
}));

vi.mock("~/ui/pixi/command/runTileDropAtom", () => ({
	runTileDropAtom: () => tileAtoms.drop,
}));

vi.mock("~/ui/pixi/command/runTileSplitAtom", () => ({
	runTileSplitAtom: () => tileAtoms.split,
}));

vi.mock("~/ui/pixi/command/runSpaceActivationAtom", () => ({
	runSpaceActivationAtom: () => tileAtoms.space,
}));

vi.mock("~/ui/game-menu/useGameMenuControl", () => ({
	useGameMenuControl: () => ({
		phase: "closed",
	}),
}));

vi.mock("~/item-detail-frame/useItemDetailControl", () => ({
	useItemDetailControl: () => ({
		state: {
			phase: "closed",
		},
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

vi.mock("~/ui/pixi/scene/createMainRuntimeFx", () => ({
	createMainRuntimeFx: (props: createMainRuntimeFx.Props) =>
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

const renderSurface = async () => {
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(PixiBoardToolbarSurface, {
				onOpenInventory: boardState.navigate,
			}),
		);
		await Promise.resolve();
	});
	return host;
};

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
	boardState.runSpaceActivation.mockClear();
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
		await renderSurface();

		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.enqueueLine).toHaveBeenCalledWith({
			kind: "reset",
		});
	});

	it("keeps an unavailable left click inert and reserves Item Detail for right click", async () => {
		await renderSurface();
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

	it("suppresses the native macOS Control-click context menu without dispatching a command", async () => {
		const host = await renderSurface();
		const surface = host.querySelector<HTMLElement>('[data-ui="PixiBoardToolbarSurface"]');
		if (surface === null) throw new Error("Missing Board surface.");
		const contextMenu = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			ctrlKey: true,
		});

		surface.dispatchEvent(contextMenu);

		expect(contextMenu.defaultPrevented).toBe(true);
		expect(boardState.enqueueLine).not.toHaveBeenCalled();
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
	});

	it("submits an exact Board-stack split without invoking the tile primary action", async () => {
		await renderSurface();
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

	it("routes single and fill default-line intents without interpreting queue capacity", async () => {
		await renderSurface();
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
				queue: {
					available: true,
					capacity: 5,
					used: 2,
				},
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
			ownerItemId: producer.id,
		});
		await createProps.onActivate(
			producer,
			"fill-default-line-queue",
			document.createElement("canvas"),
		);

		expect(boardState.enqueueLine).toHaveBeenLastCalledWith({
			kind: "fill",
			ownerItemId: producer.id,
		});
		await createProps.onActivate(
			{
				...producer,
				location: {
					scope: "toolbar",
					position: {
						x: 0,
						y: 0,
					},
				},
			},
			"fill-default-line-queue",
			document.createElement("canvas"),
		);

		expect(boardState.enqueueLine).toHaveBeenCalledTimes(2);
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
	});

	it("routes the open-inventory primary action to the sibling Inventory leaf", async () => {
		await renderSurface();
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

		expect(boardState.navigate).toHaveBeenCalledWith();
		expect(boardState.registerInteraction).toHaveBeenCalledOnce();
	});

	it("opens Inventory with an unmodified i key while the Board is idle", async () => {
		await renderSurface();
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
		expect(boardState.navigate).toHaveBeenCalledWith();
	});

	it("does not hijack modified, repeated, or editable i key input", async () => {
		await renderSurface();
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
