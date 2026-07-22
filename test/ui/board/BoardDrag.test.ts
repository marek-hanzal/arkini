// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { Board } from "~/ui/board/Board";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";
import { testGameRead, testGameReadOrThrow } from "~test/support/game/testGameRead";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameEngineState = vi.hoisted(() => ({
	game: undefined as GameEngine | undefined,
}));
const dropItemState = vi.hoisted(() => ({
	drop: vi.fn<(_: dropItemFx.Props) => Promise<dropItemFx.Result>>(),
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
	useDropItem: () => dropItemState.drop,
}));

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

const expectArtworkOnlyVisual = (visual: HTMLElement) => {
	expect(visual.classList).toContain("bg-transparent");
	expect(visual.classList).not.toContain("bg-surface-raised/95");
	expect(visual.classList).not.toContain("border");
};

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
			{
				itemId: "tree",
				space: 0,
				x: 0,
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
			merge: [
				{
					target: {
						type: "item",
						itemId: "tree",
					},
					action: "consume",
					effect: "keep",
				},
			],
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
		tree: {
			id: "tree",
			type: "simple",
			title: "Tree",
			description: "Tree",
			asset: {
				source: [
					"asset:tree",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 1,
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
const publishRuntime = (next: typeof runtime) => {
	currentRuntime = next;
	for (const listener of runtimeListeners) listener();
};
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
	readOrThrow: testGameReadOrThrow,
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

beforeEach(() => {
	motionTestRuntime.reset();
	currentRuntime = runtime;
	runtimeListeners.clear();
	gameEngineState.game = game;
	dropItemState.drop.mockReset();
	Object.defineProperty(document.documentElement, "clientWidth", {
		configurable: true,
		value: 800,
	});
	Object.defineProperty(document.documentElement, "clientHeight", {
		configurable: true,
		value: 600,
	});
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: 800,
	});
	Object.defineProperty(window, "innerHeight", {
		configurable: true,
		value: 600,
	});
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const element = this as HTMLElement;
			if (element.dataset.ui === "BoardGrid") return rect(0, 0, 300, 200);
			if (element.dataset.ui === "TileActorLayer") return rect(0, 0, 300, 200);
			if (element.dataset.ui === "TileActorDragSurface") {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				const x = Number(actor?.dataset.boardX);
				const y = Number(actor?.dataset.boardY);
				if (Number.isFinite(x) && Number.isFinite(y))
					return rect(x * 100, y * 100, 100, 100);
			}
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
	vi.useRealTimers();
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
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(TileSystemProvider, null, createElement(Board)),
				createElement(ItemDetailModal),
			),
		);
		await Promise.resolve();
	});
	const source = document.querySelector<HTMLElement>(
		'[data-ui="TileActor"][data-board-x="2"][data-board-y="1"]',
	);
	if (source === null) throw new Error("Missing draggable source actor.");
	return source;
};

const dragTo = async (source: HTMLElement, x: number, y: number) => {
	const dragSurface = source.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
	if (dragSurface === null) throw new Error("Missing drag surface.");
	await act(async () => {
		dragSurface.dispatchEvent(pointerEvent("pointerdown", 250, 150));
		dragSurface.dispatchEvent(pointerEvent("pointermove", x, y));
		dragSurface.dispatchEvent(pointerEvent("pointerup", x, y));
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("Board drag", () => {
	it("animates an off-center pickup toward the pointer instead of snapping on press", async () => {
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		const dragSurface = source.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
		if (runtimeId === undefined || dragSurface === null)
			throw new Error("Missing draggable actor identity.");

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 210, 110));
			await Promise.resolve();
		});

		expect(motionTestRuntime.readDragOffset()).toEqual({
			x: 0,
			y: 0,
		});
		expect(motionTestRuntime.readMotionOffset("TileActorPickup", runtimeId)).toEqual({
			x: 0,
			y: 0,
		});

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointermove", 217, 117));
			await Promise.resolve();
		});

		expect(motionTestRuntime.readMotionOffset("TileActorPickup", runtimeId)).toEqual({
			x: -40,
			y: -40,
		});
		expect(motionTestRuntime.readMotionOffset("TileActorWeight", runtimeId)).toEqual({
			x: -2.45,
			y: -1.96,
		});
		const yieldedActor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		const yieldedRuntimeId = yieldedActor?.dataset.runtimeId;
		if (yieldedRuntimeId === undefined) throw new Error("Missing neighbour actor identity.");
		const yieldedOffset = motionTestRuntime.readMotionOffset(
			"TileActor",
			yieldedRuntimeId,
		);
		expect(yieldedOffset).not.toEqual({
			x: 0,
			y: 0,
		});

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointercancel", 217, 117));
			await Promise.resolve();
		});

		expect(motionTestRuntime.readMotionOffset("TileActorWeight", runtimeId)).toEqual({
			x: 0,
			y: 0,
		});
		expect(motionTestRuntime.readMotionOffset("TileActor", yieldedRuntimeId)).toEqual({
			x: 0,
			y: 0,
		});
	});
	it("removes cursor lag and neighbour yielding for reduced motion", async () => {
		motionTestRuntime.reducedMotion = true;
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		const dragSurface = source.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
		const neighbour = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		const neighbourId = neighbour?.dataset.runtimeId;
		if (runtimeId === undefined || dragSurface === null || neighbourId === undefined) {
			throw new Error("Missing reduced-motion actor identity.");
		}

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 210, 110));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 217, 117));
			await Promise.resolve();
		});

		expect(motionTestRuntime.readMotionOffset("TileActorWeight", runtimeId)).toEqual({
			x: 0,
			y: 0,
		});
		expect(motionTestRuntime.readMotionOffset("TileActor", neighbourId)).toEqual({
			x: 0,
			y: 0,
		});

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointercancel", 217, 117));
		});
	});

	it("moves the one existing actor through the public atomic drop command", async () => {
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		const revision = source.dataset.runtimeRevision;
		if (runtimeId === undefined || revision === undefined) throw new Error("Missing identity.");
		dropItemState.drop.mockResolvedValue({
			kind: DropItemResultKindEnumSchema.enum.Move,
			itemId: runtimeId,
			revision: "revision:moved",
			previousLocation: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 1,
				},
			},
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});

		const title = source.querySelector<HTMLElement>('[data-ui="TileActorTitle"]');
		expect(title?.textContent).toBe("Water");

		await dragTo(source, 50, 50);

		expect(dropItemState.drop).toHaveBeenCalledOnce();
		expect(dropItemState.drop).toHaveBeenCalledWith({
			sourceItemId: runtimeId,
			sourceRevision: revision,
			sourceLocation: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 1,
				},
			},
			target: {
				kind: "slot",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
				occupant: null,
			},
		});
		const liveActor = document.querySelector(`[data-runtime-id="${runtimeId}"]`);
		expect(document.querySelectorAll(`[data-runtime-id="${runtimeId}"]`)).toHaveLength(1);
		expect(liveActor).toBe(source);
		expect(source.querySelector('[data-ui="TileActorTitle"]')?.textContent).toBe("Water");
		expect(document.querySelector('[data-ui="TileDragGhost"]')).toBeNull();
	});

	it("previews and swaps both existing actors without remounting", async () => {
		const source = await renderBoard();
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="1"][data-board-y="0"]',
		);
		if (target === null) throw new Error("Missing swap target actor.");
		const sourceId = source.dataset.runtimeId;
		const sourceRevision = source.dataset.runtimeRevision;
		const targetId = target.dataset.runtimeId;
		const targetRevision = target.dataset.runtimeRevision;
		if (
			sourceId === undefined ||
			sourceRevision === undefined ||
			targetId === undefined ||
			targetRevision === undefined
		) {
			throw new Error("Missing swap identities.");
		}
		const swapOutcome: Extract<
			dropItemFx.Result,
			{
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Swap;
			}
		> = {
			kind: DropItemResultKindEnumSchema.enum.Swap,
			source: {
				itemId: sourceId,
				revision: "revision:source-swapped",
				previousLocation: {
					scope: "board",
					space: 0,
					position: {
						x: 2,
						y: 1,
					},
				},
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
			},
			target: {
				itemId: targetId,
				revision: "revision:target-swapped",
				previousLocation: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 2,
						y: 1,
					},
				},
			},
		};
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.map((item) => {
					if (item.id === sourceId) {
						return {
							...item,
							revision: swapOutcome.source.revision,
							location: swapOutcome.source.location,
						};
					}
					if (item.id === targetId) {
						return {
							...item,
							revision: swapOutcome.target.revision,
							location: swapOutcome.target.location,
						};
					}
					return item;
				}),
			});
			return swapOutcome;
		});

		const dragSurface = source.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
		if (dragSurface === null) throw new Error("Missing drag surface.");
		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 250, 150));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 150, 50));
		});
		expect(
			target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset.motionScale,
		).toBe("1.08");
		expect(motionTestRuntime.readMotionOffset("TileActor", targetId)).toEqual({
			x: 0,
			y: 0,
		});
		const passiveNeighbour = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		const passiveNeighbourId = passiveNeighbour?.dataset.runtimeId;
		if (passiveNeighbourId === undefined)
			throw new Error("Missing passive neighbour identity.");
		expect(
			motionTestRuntime.readMotionOffset("TileActor", passiveNeighbourId),
		).not.toEqual({
			x: 0,
			y: 0,
		});

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerup", 150, 50));
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(dropItemState.drop).toHaveBeenCalledOnce();
		expect(dropItemState.drop).toHaveBeenCalledWith({
			sourceItemId: sourceId,
			sourceRevision,
			sourceLocation: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 1,
				},
			},
			target: {
				kind: "slot",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
				occupant: {
					itemId: targetId,
					revision: targetRevision,
				},
			},
		});
		expect(source.dataset.boardX).toBe("1");
		expect(source.dataset.boardY).toBe("0");
		expect(target.dataset.boardX).toBe("2");
		expect(target.dataset.boardY).toBe("1");
		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBe(source);
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(document.querySelectorAll(`[data-runtime-id="${sourceId}"]`)).toHaveLength(1);
		expect(document.querySelectorAll(`[data-runtime-id="${targetId}"]`)).toHaveLength(1);
		expect(document.querySelector('[data-ui="TileDragGhost"]')).toBeNull();
	});

	it("retains a consumed source actor through merge approach and exits it after target impact", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		if (target === null) throw new Error("Missing merge target actor.");
		const sourceId = source.dataset.runtimeId;
		const sourceRevision = source.dataset.runtimeRevision;
		const targetId = target.dataset.runtimeId;
		const targetRevision = target.dataset.runtimeRevision;
		if (
			sourceId === undefined ||
			sourceRevision === undefined ||
			targetId === undefined ||
			targetRevision === undefined
		) {
			throw new Error("Missing merge identities.");
		}
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 1,
			},
		};
		const mergeOutcome: Extract<
			dropItemFx.Result,
			{
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Merge;
			}
		> = {
			kind: DropItemResultKindEnumSchema.enum.Merge,
			action: "consume",
			effect: "keep",
			source: {
				itemId: sourceId,
				previousRevision: sourceRevision,
				previousLocation: sourceLocation,
				previousQuantity: 1,
				current: null,
			},
			target: {
				itemId: targetId,
				previousRevision: targetRevision,
				previousLocation: targetLocation,
				previousQuantity: 1,
				current: {
					itemId: targetId,
					canonicalItemId: "tree",
					revision: targetRevision,
					location: targetLocation,
					quantity: 1,
				},
			},
		};
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.id !== sourceId),
			});
			return mergeOutcome;
		});

		await dragTo(source, 50, 150);

		expect(dropItemState.drop).toHaveBeenCalledWith({
			sourceItemId: sourceId,
			sourceRevision,
			sourceLocation,
			target: {
				kind: "slot",
				location: targetLocation,
				occupant: {
					itemId: targetId,
					revision: targetRevision,
				},
			},
		});
		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBe(source);
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		const sourceVisual = source.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
		const targetVisual = target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
		if (sourceVisual === null || targetVisual === null)
			throw new Error("Missing merge visuals.");
		expect(sourceVisual.dataset.motionPhase).toBe("exiting");
		expect(targetVisual.dataset.motionPhase).toBe("impact");
		expectArtworkOnlyVisual(sourceVisual);
		expectArtworkOnlyVisual(targetVisual);

		await act(async () => {
			motionTestRuntime.finish(
				...motionTestRuntime.completions.map((_completion, index) => index),
			);
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBeNull();
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(
			target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset.motionPhase,
		).toBe("stable");
	});

	it("reuses the exact target actor identity when a merge replaces its canonical item", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		if (target === null) throw new Error("Missing replacement target actor.");
		const sourceId = source.dataset.runtimeId;
		const sourceRevision = source.dataset.runtimeRevision;
		const targetId = target.dataset.runtimeId;
		const targetRevision = target.dataset.runtimeRevision;
		if (
			sourceId === undefined ||
			sourceRevision === undefined ||
			targetId === undefined ||
			targetRevision === undefined
		) {
			throw new Error("Missing replacement identities.");
		}
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 1,
			},
		};
		const replacedRevision = "revision:tree-replaced";
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items
					.filter((item) => item.id !== sourceId)
					.map((item) =>
						item.id === targetId
							? {
									...item,
									item: config.items.stone,
									revision: replacedRevision,
								}
							: item,
					),
			});
			return {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				action: "consume",
				effect: "replace",
				resultCanonicalItemId: "stone",
				source: {
					itemId: sourceId,
					previousRevision: sourceRevision,
					previousLocation: sourceLocation,
					previousQuantity: 1,
					current: null,
				},
				target: {
					itemId: targetId,
					previousRevision: targetRevision,
					previousLocation: targetLocation,
					previousQuantity: 1,
					current: {
						itemId: targetId,
						canonicalItemId: "stone",
						revision: replacedRevision,
						location: targetLocation,
						quantity: 1,
					},
				},
			};
		});

		await dragTo(source, 50, 150);

		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(target.querySelector('[data-ui="TileActorTitle"]')?.textContent).toBe("Stone");
		expect(target.dataset.runtimeRevision).toBe(replacedRevision);
		expect(
			target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset.motionPhase,
		).toBe("impact");

		await act(async () => {
			motionTestRuntime.finish(
				...motionTestRuntime.completions.map((_completion, index) => index),
			);
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBeNull();
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(target.querySelector('[data-ui="TileActorTitle"]')?.textContent).toBe("Stone");
	});

	it("keeps both removed merge actors alive only through their owned exit generation", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		if (target === null) throw new Error("Missing removal target actor.");
		const sourceId = source.dataset.runtimeId;
		const sourceRevision = source.dataset.runtimeRevision;
		const targetId = target.dataset.runtimeId;
		const targetRevision = target.dataset.runtimeRevision;
		if (
			sourceId === undefined ||
			sourceRevision === undefined ||
			targetId === undefined ||
			targetRevision === undefined
		) {
			throw new Error("Missing removal identities.");
		}
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 1,
			},
		};
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter(
					(item) => item.id !== sourceId && item.id !== targetId,
				),
			});
			return {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				action: "consume",
				effect: "remove",
				source: {
					itemId: sourceId,
					previousRevision: sourceRevision,
					previousLocation: sourceLocation,
					previousQuantity: 1,
					current: null,
				},
				target: {
					itemId: targetId,
					previousRevision: targetRevision,
					previousLocation: targetLocation,
					previousQuantity: 1,
					current: null,
				},
			};
		});

		await dragTo(source, 50, 150);

		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBe(source);
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(
			source.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset.motionPhase,
		).toBe("exiting");
		expect(
			target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]')?.dataset.motionPhase,
		).toBe("exiting");

		await act(async () => {
			motionTestRuntime.finish(
				...motionTestRuntime.completions.map((_completion, index) => index),
			);
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBeNull();
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBeNull();
	});

	it("allows the surviving merge actor to interrupt impact and issue the next command immediately", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		if (target === null) throw new Error("Missing merge survivor actor.");
		const sourceId = source.dataset.runtimeId;
		const sourceRevision = source.dataset.runtimeRevision;
		const targetId = target.dataset.runtimeId;
		const targetRevision = target.dataset.runtimeRevision;
		if (
			sourceId === undefined ||
			sourceRevision === undefined ||
			targetId === undefined ||
			targetRevision === undefined
		) {
			throw new Error("Missing merge survivor identities.");
		}
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 1,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 1,
			},
		};
		const chainedLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		};
		const chainedRevision = "revision:tree-chained";

		dropItemState.drop
			.mockImplementationOnce(async () => {
				publishRuntime({
					...currentRuntime,
					items: currentRuntime.items.filter((item) => item.id !== sourceId),
				});
				return {
					kind: DropItemResultKindEnumSchema.enum.Merge,
					action: "consume",
					effect: "keep",
					source: {
						itemId: sourceId,
						previousRevision: sourceRevision,
						previousLocation: sourceLocation,
						previousQuantity: 1,
						current: null,
					},
					target: {
						itemId: targetId,
						previousRevision: targetRevision,
						previousLocation: targetLocation,
						previousQuantity: 1,
						current: {
							itemId: targetId,
							canonicalItemId: "tree",
							revision: targetRevision,
							location: targetLocation,
							quantity: 1,
						},
					},
				};
			})
			.mockImplementationOnce(async () => {
				publishRuntime({
					...currentRuntime,
					items: currentRuntime.items.map((item) =>
						item.id === targetId
							? {
									...item,
									revision: chainedRevision,
									location: chainedLocation,
								}
							: item,
					),
				});
				return {
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId: targetId,
					revision: chainedRevision,
					previousLocation: targetLocation,
					location: chainedLocation,
				};
			});

		await dragTo(source, 50, 150);

		const targetVisual = target.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
		const targetDragSurface = target.querySelector<HTMLElement>(
			'[data-ui="TileActorDragSurface"]',
		);
		if (targetVisual === null || targetDragSurface === null) {
			throw new Error("Missing merge survivor presentation.");
		}
		expect(targetVisual.dataset.motionPhase).toBe("impact");
		expect(source.style.pointerEvents).toBe("none");

		await act(async () => {
			targetDragSurface.dispatchEvent(pointerEvent("pointerdown", 50, 150));
			targetDragSurface.dispatchEvent(pointerEvent("pointermove", 250, 50));
			motionTestRuntime.finish(
				...motionTestRuntime.completions.map((_completion, index) => index),
			);
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(targetVisual.dataset.motionPhase).toBe("dragging");
		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBeNull();

		await act(async () => {
			targetDragSurface.dispatchEvent(pointerEvent("pointerup", 250, 50));
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(dropItemState.drop).toHaveBeenCalledTimes(2);
		expect(dropItemState.drop).toHaveBeenLastCalledWith({
			sourceItemId: targetId,
			sourceRevision: targetRevision,
			sourceLocation: targetLocation,
			target: {
				kind: "slot",
				location: chainedLocation,
				occupant: null,
			},
		});
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(target.dataset.boardX).toBe("2");
		expect(target.dataset.boardY).toBe("0");
	});

	it("keeps an active drag actor targeted through an unrelated runtime publication", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		const visual = source.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
		const dragSurface = source.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
		if (runtimeId === undefined || visual === null || dragSurface === null) {
			throw new Error("Missing active drag actor facts.");
		}
		expect(source.className).toContain("cursor-grab");

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 250, 150));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 150, 50));
		});
		expect(visual.dataset.motionPhase).toBe("dragging");
		expect(source.className).toContain("cursor-grabbing");
		const dragOffset = motionTestRuntime.readDragOffset();

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
			});
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${runtimeId}"]`)).toBe(source);
		expect(visual.dataset.motionPhase).toBe("dragging");
		expect(motionTestRuntime.readDragOffset()).toEqual(dragOffset);
	});

	it("releases the shared gesture when the dragged actor disappears autonomously", async () => {
		motionTestRuntime.autoComplete = false;
		const source = await renderBoard();
		const sourceId = source.dataset.runtimeId;
		const dragSurface = source.querySelector<HTMLElement>(
			'[data-ui="TileActorDragSurface"]',
		);
		if (sourceId === undefined || dragSurface === null) {
			throw new Error("Missing autonomously removed drag actor.");
		}

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 250, 150));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 150, 50));
		});

		await act(async () => {
			publishRuntime({
				...currentRuntime,
				items: currentRuntime.items.filter((item) => item.id !== sourceId),
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBeNull();

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerup", 150, 50));
			await Promise.resolve();
		});
		expect(dropItemState.drop).not.toHaveBeenCalled();

		const next = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-board-x="0"][data-board-y="1"]',
		);
		const nextDragSurface = next?.querySelector<HTMLElement>(
			'[data-ui="TileActorDragSurface"]',
		);
		const nextVisual = next?.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
		if (nextDragSurface == null || nextVisual == null) {
			throw new Error("Missing actor for the gesture reuse check.");
		}

		await act(async () => {
			nextDragSurface.dispatchEvent(pointerEvent("pointerdown", 50, 150));
			nextDragSurface.dispatchEvent(pointerEvent("pointermove", 57, 157));
		});

		expect(nextVisual.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			nextDragSurface.dispatchEvent(pointerEvent("pointercancel", 57, 157));
		});
	});

	it("opens one Item Detail modal from the exact live actor double-click", async () => {
		const source = await renderBoard();
		const runtimeId = source.dataset.runtimeId;
		if (runtimeId === undefined) throw new Error("Missing source runtime identity.");

		await act(async () => {
			source.dispatchEvent(
				new MouseEvent("dblclick", {
					bubbles: true,
					button: 0,
					cancelable: true,
				}),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		const modal = document.querySelector<HTMLElement>('[data-ui="ItemDetailModal"]');
		expect(modal).not.toBeNull();
		expect(modal?.dataset.runtimeId).toBe(runtimeId);
		expect(modal?.dataset.tab).toBe("info");
		expect(document.querySelectorAll('[data-ui="ItemDetailModal"]')).toHaveLength(1);
		expect(source.style.pointerEvents).toBe("none");
	});
});
