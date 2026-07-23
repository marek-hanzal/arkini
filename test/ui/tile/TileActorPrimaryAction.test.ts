// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Board } from "~/ui/board/Board";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

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
vi.mock("~/bridge/tile/useDropItem", () => ({
	useDropItem: () => vi.fn(),
}));

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:tile-primary-action",
		title: "Tile primary action",
		board: {
			width: 2,
			height: 1,
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
				itemId: "producer",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "resource",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		producer: {
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Produces resources.",
			asset: {
				source: [
					"asset:producer",
				],
			},
			tags: [],
			categoryId: "building",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:produce",
					title: "Produce",
					description: "Produce one resource.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
			],
		},
		resource: {
			id: "resource",
			type: "simple",
			title: "Resource",
			description: "One resource.",
			asset: {
				source: [
					"asset:resource",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const initialRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
let currentRuntime = initialRuntime;
const listeners = new Set<() => void>();
const transitionListeners = new Set<
	(transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>
>();
let transitionSequence = 0;
let claimedTilePresentationSequence = -1;
let currentTransition: CommittedTransitionSchema.Type = {
	sequence: transitionSequence,
	previousRuntime: null,
	runtime: currentRuntime,
	events: [],
};
const runCommand = vi.fn(() => Promise.resolve({}));
const provideCurrentRuntime = (effect: Effect.Effect<unknown, unknown, RuntimeFx>) =>
	Effect.provideService(effect, RuntimeFx, {
		read: Effect.sync(() => currentRuntime),
	});
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
	getTransitionSnapshot: () => currentTransition,
	claimTilePresentationTransition: (sequence: number) => {
		if (sequence <= claimedTilePresentationSequence) return false;
		claimedTilePresentationSequence = sequence;
		return true;
	},
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	subscribeTransitions: (listener) => {
		transitionListeners.add(listener);
		void listener(currentTransition);
		return () => transitionListeners.delete(listener);
	},
	subscribeEvents: () => () => undefined,
	read: ((effect) =>
		Effect.runSyncExit(
			provideCurrentRuntime(effect as Effect.Effect<unknown, unknown, RuntimeFx>),
		)) as GameEngine["read"],
	readOrThrow: ((effect) =>
		Effect.runSync(
			provideCurrentRuntime(effect as Effect.Effect<unknown, unknown, RuntimeFx>),
		)) as GameEngine["readOrThrow"],
	run: runCommand as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

const roots: Array<ReturnType<typeof createRoot>> = [];

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

const publishRuntime = (runtime: RuntimeSchema.Type) => {
	const previousRuntime = currentRuntime;
	currentRuntime = runtime;
	currentTransition = {
		sequence: ++transitionSequence,
		previousRuntime,
		runtime,
		events: [],
	};
	for (const listener of listeners) listener();
	for (const listener of transitionListeners) void listener(currentTransition);
};

beforeEach(() => {
	motionTestRuntime.reset();
	currentRuntime = initialRuntime;
	transitionSequence = 0;
	claimedTilePresentationSequence = -1;
	currentTransition = {
		sequence: transitionSequence,
		previousRuntime: null,
		runtime: currentRuntime,
		events: [],
	};
	listeners.clear();
	transitionListeners.clear();
	runCommand.mockReset();
	runCommand.mockResolvedValue({});
	gameEngineState.game = game;
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const element = this as HTMLElement;
			if (element.dataset.ui === "BoardGrid") return rect(0, 0, 200, 100);
			if (element.dataset.ui === "TileActorLayer") return rect(0, 0, 200, 100);
			if (
				element.dataset.ui === "TileMotionCueVisual" ||
				element.dataset.ui === "TileActorVisual"
			) {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				const x = Number(actor?.dataset.boardX);
				if (Number.isFinite(x)) return rect(x * 100 + 10, 10, 80, 80);
			}
			if (element.dataset.ui === "BoardCell") {
				return rect(Number(element.dataset.boardX) * 100, 0, 100, 100);
			}
			if (element.dataset.ui === "TileActorDragSurface") {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				return rect(Number(actor?.dataset.boardX) * 100, 0, 100, 100);
			}
			return rect(0, 0, 0, 0);
		},
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	document.body.replaceChildren();
	gameEngineState.game = undefined;
});

const renderBoard = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(TileSystemProvider, null, createElement(Board)),
				createElement(ItemDetailModal),
			),
		);
		await Promise.resolve();
		await Promise.resolve();
	});
	const producer = document.querySelector<HTMLButtonElement>(
		'[data-ui="TileActor"][data-item-id="producer"]',
	);
	const resource = document.querySelector<HTMLButtonElement>(
		'[data-ui="TileActor"][data-item-id="resource"]',
	);
	if (producer === null || resource === null) throw new Error("Missing tile actors.");
	return {
		producer,
		resource,
	};
};

const click = (actor: HTMLElement, detail = 1) => {
	if (detail === 1) {
		actor.click();
		return true;
	}
	return actor.dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			button: 0,
			cancelable: true,
			detail,
		}),
	);
};

const doubleClick = (actor: HTMLElement) =>
	actor.dispatchEvent(
		new MouseEvent("dblclick", {
			bubbles: true,
			button: 0,
			cancelable: true,
			detail: 2,
		}),
	);

const finishPrimaryActionDelay = async () => {
	await act(async () => {
		vi.advanceTimersByTime(321);
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("TileActor primary action", () => {
	it("opens Lines for a line owner without a default and ignores ordinary items", async () => {
		const { producer, resource } = await renderBoard();
		vi.useFakeTimers();
		expect(producer.dataset.primaryAction).toBe("open-lines");
		expect(producer.style.pointerEvents).toBe("auto");
		expect(resource.dataset.primaryAction).toBe("none");

		await act(async () => click(resource));
		await finishPrimaryActionDelay();
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBeNull();
		expect(runCommand).not.toHaveBeenCalled();

		await act(async () => click(producer));
		await finishPrimaryActionDelay();
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]')?.dataset.tab,
		).toBe("lines");
		expect(runCommand).not.toHaveBeenCalled();
	});

	it("starts the save-backed default line and opens Lines when the command is rejected", async () => {
		const owner = initialRuntime.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer runtime item.");
		publishRuntime(
			RuntimeSchema.parse({
				...initialRuntime,
				defaultLineByOwnerItemId: {
					[owner.id]: "line:produce",
				},
			}),
		);
		const { producer } = await renderBoard();
		vi.useFakeTimers();
		expect(producer.dataset.primaryAction).toBe("start-default-line");

		await act(async () => click(producer));
		await finishPrimaryActionDelay();
		expect(runCommand).toHaveBeenCalledTimes(1);
		expect(document.querySelector('[data-ui="ItemDetailModal"]')).toBeNull();

		runCommand.mockRejectedValueOnce(new Error("Missing inputs"));
		await act(async () => click(producer));
		await finishPrimaryActionDelay();
		expect(runCommand).toHaveBeenCalledTimes(2);
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]')?.dataset.tab,
		).toBe("lines");
	});

	it("cancels the delayed single-click when the gesture becomes a double-click", async () => {
		const owner = initialRuntime.items.find((item) => item.item.id === "producer");
		if (owner === undefined) throw new Error("Missing producer runtime item.");
		publishRuntime(
			RuntimeSchema.parse({
				...initialRuntime,
				defaultLineByOwnerItemId: {
					[owner.id]: "line:produce",
				},
			}),
		);
		const { producer } = await renderBoard();
		vi.useFakeTimers();

		await act(async () => {
			click(producer, 1);
			click(producer, 2);
			doubleClick(producer);
			await Promise.resolve();
		});
		await finishPrimaryActionDelay();

		expect(runCommand).not.toHaveBeenCalled();
		expect(
			document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]')?.dataset.tab,
		).toBe("lines");
	});
});
