// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game } from "~/bridge/game/Game";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Board } from "~/ui/board/Board";
import { TileSystemContext, type TileSystem } from "~/ui/tile/TileSystemContext";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { testGameRead } from "~test/support/game/testGameRead";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as Game | undefined,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => {
		const current = gameEngineState.game;
		if (current === undefined) throw new Error("Test Game Engine is missing.");
		return current;
	},
}));

vi.mock("~/bridge/tile/useTileActors", () => ({
	useTileActors: () => [],
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
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		runtimeListeners.add(listener);
		return () => runtimeListeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	read: testGameRead,
	run: (() => Promise.reject(new Error("Not used by this test."))) as Game["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies Game;

const roots: Array<ReturnType<typeof createRoot>> = [];

const Capture = ({ onSystem }: { readonly onSystem: (system: TileSystem) => void }) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("Missing TileSystemProvider.");
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
	let currentSystem: TileSystem | null = null;
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
	it("publishes geometry only for changed surface or occupant identity", async () => {
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
		expect(occupantChangedVersion).toBe(initialVersion + 2);

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
