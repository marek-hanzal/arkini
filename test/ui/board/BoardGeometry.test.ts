// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Board } from "~/ui/board/Board";
import type { TileSystemApi } from "~/ui/tile/TileSystemApiContext";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

vi.mock("~/ui/tile/useTileMotionCues", () => ({
	useTileMotionCues: () => ({
		liveItems: [],
		cues: new Map(),
		retainedItems: [],
		morphPreviousItems: new Map(),
		start: vi.fn(),
		contact: vi.fn(),
		complete: vi.fn(),
	}),
}));

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:board-geometry",
		title: "Board geometry",
		board: {
			width: 2,
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
				x: 1,
				y: 1,
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
	},
});

const runtime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
let currentRuntime = runtime;
let claimedTilePresentationSequence = -1;
const runtimeListeners = new Set<() => void>();
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
	getSnapshot: () => currentRuntime,
	getTransitionSnapshot: () => ({
		sequence: 0,
		previousRuntime: null,
		runtime: currentRuntime,
		events: [],
	}),
	canClaimTilePresentationTransition: (sequence: number) =>
		sequence > claimedTilePresentationSequence,
	claimTilePresentationTransition: (sequence: number) => {
		if (sequence <= claimedTilePresentationSequence) return false;
		claimedTilePresentationSequence = sequence;
		return true;
	},
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		runtimeListeners.add(listener);
		return () => runtimeListeners.delete(listener);
	},
	subscribeTransitions: (listener) => {
		void listener({
			sequence: 0,
			previousRuntime: null,
			runtime: currentRuntime,
			events: [],
		});
		return () => undefined;
	},
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	readOrThrow: testGameReadOrThrow,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Capture = ({ onSystem }: { readonly onSystem: (system: TileSystemApi) => void }) => {
	const system = useTileSystemApiContext();
	useEffect(
		() => onSystem(system),
		[
			onSystem,
			system,
		],
	);
	return null;
};

beforeEach(() => {
	currentRuntime = runtime;
	claimedTilePresentationSequence = -1;
	runtimeListeners.clear();
	gameEngineState.game = game;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	gameEngineState.game = undefined;
});

const renderBoard = async () => {
	let currentSystem: TileSystemApi | null = null;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				TileSystemProvider,
				null,
				createElement(Capture, {
					onSystem: (system) => {
						currentSystem = system;
					},
				}),
				createElement(Board),
			),
		);
		await Promise.resolve();
	});
	return () => {
		if (currentSystem === null) throw new Error("Tile system was not captured.");
		return currentSystem;
	};
};

const publishRuntime = async (next: typeof runtime) => {
	await act(async () => {
		currentRuntime = next;
		for (const listener of runtimeListeners) listener();
		await Promise.resolve();
	});
};

describe("Board geometry identity", () => {
	it("renders one stable coordinate-derived checker pattern", async () => {
		await renderBoard();
		const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-ui="BoardCell"]'));

		expect(cells.map((cell) => cell.dataset.tileSlotTone)).toEqual([
			"a",
			"b",
			"b",
			"a",
		]);
	});

	it("publishes geometry only for layout truth, not same-node occupant metadata", async () => {
		const readSystem = await renderBoard();
		const initialVersion = readSystem().geometryVersion;

		await publishRuntime({
			...currentRuntime,
		});
		expect(readSystem().geometryVersion).toBe(initialVersion);

		await publishRuntime({
			...currentRuntime,
			items: currentRuntime.items.map((item) => ({
				...item,
				quantity: item.quantity + 1,
			})),
		});
		expect(readSystem().geometryVersion).toBe(initialVersion);

		await publishRuntime({
			...currentRuntime,
			items: currentRuntime.items.map((item) => ({
				...item,
				revision: "revision:geometry-change",
			})),
		});
		const occupantChangedVersion = readSystem().geometryVersion;
		expect(occupantChangedVersion).toBe(initialVersion);

		await publishRuntime({
			...currentRuntime,
			currentSpace: 1,
		});
		expect(readSystem().geometryVersion).toBe(occupantChangedVersion + 10);
		expect(
			document.querySelector<HTMLElement>('[data-ui="BoardGrid"]')?.dataset.tileSurfaceId,
		).toBe("board:1");
	});
});
