// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Board } from "~/ui/board/Board";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as Game | undefined,
}));
const moveBoardItemState = vi.hoisted(() => ({
	move: vi.fn(() => Promise.resolve()),
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

vi.mock("~/bridge/board/useMoveBoardItem", () => ({
	useMoveBoardItem: () => moveBoardItemState.move,
}));

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

const pointerEvent = (type: string, x: number, y: number) => {
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
			value: 1,
		},
	});
	return event;
};

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:board-drag",
		title: "Board drag",
		board: {
			width: 3,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "water",
				space: 0,
				x: 2,
				y: 1,
			},
			{
				itemId: "stone",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		water: {
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
		stone: {
			id: "stone",
			type: "simple",
			title: "Stone",
			description: "Stone",
			asset: {
				source: [
					"asset:stone",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const runtime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
const game = {
	arkpack: {
		packageId: "test-package",
		contentHash: "test-hash",
		gameId: config.meta.id,
		title: config.meta.title,
		configVersion: config.version,
		compressedSize: 0,
		source: "imported" as const,
	},
	config,
	saveKey: {
		packageId: "test-package",
		contentHash: "0".repeat(64),
	},
	getSnapshot: () => runtime,
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: () => () => undefined,
	subscribeEvents: () => () => undefined,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies Game;

beforeEach(() => {
	gameEngineState.game = game;
	moveBoardItemState.move.mockReset();
	moveBoardItemState.move.mockResolvedValue(undefined);
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
			if (element.dataset.ui === "BoardGrid") return rect(0, 0, 300, 200);
			const x = Number(element.dataset.boardX);
			const y = Number(element.dataset.boardY);
			if (Number.isFinite(x) && Number.isFinite(y)) return rect(x * 100, y * 100, 100, 100);
			return rect(0, 0, 0, 0);
		},
	});
	Object.defineProperty(document, "elementsFromPoint", {
		configurable: true,
		value: vi.fn((x: number, y: number) => {
			const boardX = Math.floor(x / 100);
			const boardY = Math.floor(y / 100);
			const cell = document.querySelector(
				`[data-ui="BoardCell"][data-board-x="${boardX}"][data-board-y="${boardY}"]`,
			);
			return cell === null
				? []
				: [
						cell,
					];
		}),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
	gameEngineState.game = undefined;
});

const renderBoard = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(TileSystemProvider, null, createElement(Board)));
	});
	const source = document.querySelector<HTMLElement>(
		'[data-ui="BoardTile"][data-board-x="2"][data-board-y="1"]',
	);
	if (source === null) throw new Error("Missing draggable source tile.");
	return source;
};

const dragTo = async (source: HTMLElement, x: number, y: number) => {
	await act(async () => {
		source.dispatchEvent(pointerEvent("pointerdown", 250, 150));
		source.dispatchEvent(pointerEvent("pointermove", x, y));
		source.dispatchEvent(pointerEvent("pointerup", x, y));
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("Board drag", () => {
	it("moves one revised Board item to an empty slot", async () => {
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		const revision = source.dataset.runtimeRevision;

		await dragTo(source, 50, 50);

		expect(moveBoardItemState.move).toHaveBeenCalledOnce();
		expect(moveBoardItemState.move).toHaveBeenCalledWith({
			itemId: runtimeId,
			revision,
			space: 0,
			x: 0,
			y: 0,
		});
	});

	it("rejects an occupied target before selecting a merge, consume, or swap action", async () => {
		const source = await renderBoard();

		await dragTo(source, 150, 50);

		expect(moveBoardItemState.move).not.toHaveBeenCalled();
		expect(source.style.visibility).toBe("");
		expect(document.querySelector('[data-ui="TileDragGhost"]')).toBeNull();
	});
});
