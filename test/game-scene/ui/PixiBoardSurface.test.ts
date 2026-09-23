// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { PixiBoardSurface } from "~/game-scene/ui/PixiBoardSurface";
import type { createMainRuntimeFx } from "~/game-scene/fx/createMainRuntimeFx";

type CreateMainRuntimeProps = Parameters<typeof createMainRuntimeFx>[0];

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const boardState = vi.hoisted(() => ({
	close: vi.fn(),
	createProps: null as CreateMainRuntimeProps | null,
	navigate: vi.fn(() => Promise.resolve()),
	openItemDetail: vi.fn(),
	runDrop: vi.fn(),
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

vi.mock("~/game-audio/ui/useGameAudioControl", () => {
	const control = {
		playSfxEventFn: vi.fn(),
		requestDetailMusicFn: vi.fn(),
	};
	return {
		useGameAudioControl: () => control,
	};
});

vi.mock("@effect/atom-react", () => ({
	useAtom: () => [
		boardState.enqueueLineState,
		boardState.enqueueLine,
	],
}));

vi.mock("~/tile-interaction/ui/useTileCommands", () => ({
	useTileCommands: () => ({
		runDropFn: boardState.runDrop,
	}),
}));

vi.mock("~/game-presentation/ui/useGameEngine", () => ({
	useGameEngine: () => ({}),
}));

vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: Effect.runPromise,
		runSync: Effect.runSync,
	},
}));

vi.mock("~/tile-interaction/atom/TileDefaultLineCommandAtom", () => ({
	TileDefaultLineCommandAtom: () => ({}),
}));

vi.mock("~/game-menu/ui/GameMenuProvider", () => ({
	useGameMenuControl: () => ({
		phase: "closed",
	}),
}));

vi.mock("~/item-detail-frame/ui/useItemDetailControl", () => ({
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

vi.mock("~/game-scene/ui/PixiGameRuntime", () => ({
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

vi.mock("~/game-scene/fx/createMainRuntimeFx", () => ({
	createMainRuntimeFx: (props: CreateMainRuntimeProps) =>
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
		root.render(createElement(PixiBoardSurface, {}));
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
	boardState.registerInteraction.mockClear();
	boardState.enqueueLine.mockClear();
	boardState.enqueueLineState = {
		kind: "idle",
	};
	boardState.unregisterInteraction.mockClear();
	document.body.replaceChildren();
});

describe("PixiBoardSurface", () => {
	it("silently resets a failed primary action without opening Item Detail", async () => {
		boardState.enqueueLineState = {
			kind: "error",
			error: {
				_tag: "UnitsUnavailable",
			},
			ownerItemId: "runtime:producer",
		};
		await renderSurface();

		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.enqueueLine).toHaveBeenCalledWith({
			kind: "reset",
		});
	});

	it("keeps an unavailable primary intent inert and opens Item Detail for detail intent", async () => {
		await renderSurface();
		const createProps = boardState.createProps;
		if (createProps === null) throw new Error("Board scene did not create its runtime.");
		const owner = {
			id: "runtime:producer",
			itemUid: "producer",

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
			revision: "revision:producer",
			running: false,

			artworkScale: 0.8,
			sourceUrl: "resource:producer",
		} satisfies TileActorItem;
		const canvas = document.createElement("canvas");

		await createProps.onActivateFn(owner, "primary", canvas);

		expect(boardState.enqueueLine).not.toHaveBeenCalled();
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
		expect(boardState.navigate).not.toHaveBeenCalled();

		await createProps.onActivateFn(owner, "detail", canvas);

		expect(boardState.openItemDetail).toHaveBeenCalledWith({
			itemId: owner.id,
			origin: canvas,
		});
		expect(boardState.enqueueLine).not.toHaveBeenCalled();
	});

	it("suppresses the native macOS Control-click context menu without dispatching a command", async () => {
		const host = await renderSurface();
		const surface = host.querySelector<HTMLElement>('[data-ui="PixiBoardSurface"]');
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

	it("routes single and fill default-line intents without interpreting queue capacity", async () => {
		await renderSurface();
		const createProps = boardState.createProps;
		if (createProps === null) throw new Error("Board scene did not create its runtime.");
		const producer = {
			id: "runtime:producer",
			itemUid: "producer",

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
			revision: "revision:producer:running",
			running: true,

			artworkScale: 0.8,
			sourceUrl: "resource:producer",
		} satisfies TileActorItem;

		await createProps.onActivateFn(producer, "primary", document.createElement("canvas"));

		expect(boardState.enqueueLine).toHaveBeenCalledWith({
			kind: "enqueue",
			ownerItemId: producer.id,
		});
		await createProps.onActivateFn(
			producer,
			"fill-default-line-queue",
			document.createElement("canvas"),
		);

		expect(boardState.enqueueLine).toHaveBeenLastCalledWith({
			kind: "fill",
			ownerItemId: producer.id,
		});
		expect(boardState.enqueueLine).toHaveBeenCalledTimes(2);
		expect(boardState.openItemDetail).not.toHaveBeenCalled();
	});
});
