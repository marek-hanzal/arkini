// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
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
const runtimeListeners = new Set<() => void>();
const transitionListeners = new Set<
	(transition: CommittedTransitionSchema.Type) => void | PromiseLike<void>
>();

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

const board = (x: number, y: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});
const toolbar = (x: number) => ({
	scope: "toolbar" as const,
	position: {
		x,
		y: 0,
	},
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:toolbar-drag",
		title: "Toolbar drag",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
		toolbarSize: 2,
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
			{
				itemId: "stone",
				space: 0,
				x: 0,
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

const initialRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
const roundTripRuntime = RuntimeSchema.parse({
	...initialRuntime,
	items: initialRuntime.items.map((item) =>
		item.item.id === "stone"
			? {
					...item,
					location: toolbar(1),
				}
			: item,
	),
});
let currentRuntime = roundTripRuntime;
let transitionSequence = 0;
let claimedTilePresentationSequence = -1;
let currentTransition: CommittedTransitionSchema.Type = {
	sequence: transitionSequence,
	previousRuntime: null,
	runtime: currentRuntime,
	events: [],
};

const publishRuntime = (next: RuntimeSchema.Type) => {
	const previousRuntime = currentRuntime;
	currentRuntime = next;
	currentTransition = {
		sequence: ++transitionSequence,
		previousRuntime,
		runtime: next,
		events: [],
	};
	for (const listener of runtimeListeners) listener();
	for (const listener of transitionListeners) void listener(currentTransition);
};
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
	run: (() => Promise.reject(new Error("Not used by this test."))) as GameEngine["run"],
	disposeFx: Effect.void,
	disposeWithoutSaveFx: Effect.void,
	flushSaveFx: Effect.void,
} satisfies GameEngine;

beforeEach(() => {
	motionTestRuntime.reset();
	currentRuntime = roundTripRuntime;
	transitionSequence = 0;
	claimedTilePresentationSequence = -1;
	currentTransition = {
		sequence: transitionSequence,
		previousRuntime: null,
		runtime: currentRuntime,
		events: [],
	};
	runtimeListeners.clear();
	transitionListeners.clear();
	gameEngineState.game = game;
	dropItemState.drop.mockReset();
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const element = this as HTMLElement;
			if (element.dataset.ui === "BoardGrid") return rect(0, 0, 200, 200);
			if (element.dataset.ui === "ToolbarGrid") return rect(0, 220, 200, 100);
			if (element.dataset.ui === "TileActorLayer") return rect(0, 0, 200, 320);
			if (
				element.dataset.ui === "TileMotionCueVisual" ||
				element.dataset.ui === "TileActorVisual"
			) {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				const runtimeId = actor?.dataset.runtimeId;
				const visual = actor?.querySelector<HTMLElement>('[data-ui="TileActorVisual"]');
				const scale = Number(visual?.dataset.motionScale ?? 0.8);
				if (runtimeId !== undefined && Number.isFinite(scale)) {
					const travel = motionTestRuntime.readMotionOffset(
						"TileActorTravel",
						runtimeId,
					) ?? {
						x: 0,
						y: 0,
					};
					const pointer = motionTestRuntime.readMotionOffset(
						"TileActorPointer",
						runtimeId,
					) ?? {
						x: 0,
						y: 0,
					};
					const response = motionTestRuntime.readMotionOffset(
						"TileActorPhysicalResponse",
						runtimeId,
					) ?? {
						x: 0,
						y: 0,
					};
					const pickup = motionTestRuntime.readMotionOffset(
						"TileActorPickup",
						runtimeId,
					) ?? {
						x: 0,
						y: 0,
					};
					const neighbour = motionTestRuntime.readMotionOffset(
						"TileActor",
						runtimeId,
					) ?? {
						x: 0,
						y: 0,
					};
					const size = 100 * scale;
					const base =
						actor?.dataset.locationScope === "toolbar"
							? {
									x: Number(actor.dataset.toolbarX) * 100,
									y: 220,
								}
							: {
									x: Number(actor?.dataset.boardX) * 100,
									y: Number(actor?.dataset.boardY) * 100,
								};
					if (Number.isFinite(base.x) && Number.isFinite(base.y)) {
						return rect(
							base.x +
								(100 - size) / 2 +
								travel.x +
								pointer.x +
								response.x +
								pickup.x +
								neighbour.x,
							base.y +
								(100 - size) / 2 +
								travel.y +
								pointer.y +
								response.y +
								pickup.y +
								neighbour.y,
							size,
							size,
						);
					}
				}
			}
			if (element.dataset.ui === "TileActorDragSurface") {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				if (actor?.dataset.locationScope === "toolbar") {
					const x = Number(actor.dataset.toolbarX);
					if (Number.isFinite(x)) return rect(x * 100, 220, 100, 100);
				}
				const x = Number(actor?.dataset.boardX);
				const y = Number(actor?.dataset.boardY);
				if (Number.isFinite(x) && Number.isFinite(y)) {
					return rect(x * 100, y * 100, 100, 100);
				}
			}
			if (element.dataset.ui === "ToolbarCell") {
				const x = Number(element.dataset.toolbarX);
				if (Number.isFinite(x)) return rect(x * 100, 220, 100, 100);
			}
			const x = Number(element.dataset.boardX);
			const y = Number(element.dataset.boardY);
			if (Number.isFinite(x) && Number.isFinite(y)) {
				return rect(x * 100, y * 100, 100, 100);
			}
			return rect(0, 0, 0, 0);
		},
	});
	Object.defineProperty(document, "elementsFromPoint", {
		configurable: true,
		value: vi.fn((x: number, y: number) => {
			if (y >= 220 && y < 320) {
				const toolbarX = Math.floor(x / 100);
				const cell = document.querySelector(
					`[data-ui="ToolbarCell"][data-toolbar-x="${toolbarX}"]`,
				);
				return cell === null
					? []
					: [
							cell,
						];
			}
			if (y >= 0 && y < 200) {
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
			}
			return [];
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

const renderGameBoard = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(TileSystemProvider, null, createElement(GameBoardLayout)),
				createElement(ItemDetailModal),
			),
		);
		await Promise.resolve();
	});
};

const drag = async ({
	actor,
	from,
	to,
}: {
	readonly actor: HTMLElement;
	readonly from: readonly [
		number,
		number,
	];
	readonly to: readonly [
		number,
		number,
	];
}) => {
	const dragSurface = actor.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
	if (dragSurface === null) throw new Error("Missing actor drag surface.");
	await act(async () => {
		dragSurface.dispatchEvent(pointerEvent("pointerdown", from[0], from[1]));
		dragSurface.dispatchEvent(pointerEvent("pointermove", to[0], to[1]));
		dragSurface.dispatchEvent(pointerEvent("pointerup", to[0], to[1]));
		await Promise.resolve();
		await Promise.resolve();
	});
};

describe("Toolbar drag", () => {
	it("reuses weighted drag on Toolbar without displacing Board actors", async () => {
		await renderGameBoard();
		const toolbarActor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-location-scope="toolbar"]',
		);
		const boardActor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-location-scope="board"]',
		);
		const toolbarId = toolbarActor?.dataset.runtimeId;
		const boardId = boardActor?.dataset.runtimeId;
		const dragSurface = toolbarActor?.querySelector<HTMLElement>(
			'[data-ui="TileActorDragSurface"]',
		);
		if (toolbarId === undefined || boardId === undefined || dragSurface == null) {
			throw new Error("Missing cross-surface actor identity.");
		}

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 150, 270));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 157, 277));
			await Promise.resolve();
		});

		expect(motionTestRuntime.readMotionOffset("TileActorPhysicalResponse", toolbarId)).toEqual({
			x: -1.4,
			y: -1.12,
		});
		expect(motionTestRuntime.readMotionOffset("TileActor", boardId)).toEqual({
			x: 0,
			y: 0,
		});

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointercancel", 157, 277));
		});
	});

	it("moves one real actor Board to Toolbar and back through exact slot targets", async () => {
		await renderGameBoard();
		const actor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-item-id="water"]',
		);
		if (actor === null) throw new Error("Missing Board source actor.");
		const itemId = actor.dataset.runtimeId;
		const initialRevision = actor.dataset.runtimeRevision;
		if (itemId === undefined || initialRevision === undefined) {
			throw new Error("Missing Board source identity.");
		}
		const firstRevision = "revision:toolbar-stored";
		const secondRevision = "revision:board-restored";
		dropItemState.drop
			.mockImplementationOnce(async () => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						items: currentRuntime.items.map((item) =>
							item.id === itemId
								? {
										...item,
										revision: firstRevision,
										location: toolbar(0),
									}
								: item,
						),
					}),
				);
				return {
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId,
					revision: firstRevision,
					previousLocation: board(1, 1),
					location: toolbar(0),
				};
			})
			.mockImplementationOnce(async () => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						items: currentRuntime.items.map((item) =>
							item.id === itemId
								? {
										...item,
										revision: secondRevision,
										location: board(0, 1),
									}
								: item,
						),
					}),
				);
				return {
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId,
					revision: secondRevision,
					previousLocation: toolbar(0),
					location: board(0, 1),
				};
			});

		await drag({
			actor,
			from: [
				150,
				150,
			],
			to: [
				50,
				270,
			],
		});

		expect(dropItemState.drop).toHaveBeenNthCalledWith(1, {
			sourceItemId: itemId,
			sourceRevision: initialRevision,
			sourceLocation: board(1, 1),
			target: {
				kind: "slot",
				location: toolbar(0),
				occupant: null,
			},
		});
		expect(document.querySelector(`[data-runtime-id="${itemId}"]`)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(actor.dataset.toolbarX).toBe("0");

		await drag({
			actor,
			from: [
				50,
				270,
			],
			to: [
				50,
				150,
			],
		});

		expect(dropItemState.drop).toHaveBeenNthCalledWith(2, {
			sourceItemId: itemId,
			sourceRevision: firstRevision,
			sourceLocation: toolbar(0),
			target: {
				kind: "slot",
				location: board(0, 1),
				occupant: null,
			},
		});
		expect(document.querySelector(`[data-runtime-id="${itemId}"]`)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("board");
		expect(actor.dataset.boardX).toBe("0");
		expect(actor.dataset.boardY).toBe("1");
		expect(document.querySelectorAll(`[data-runtime-id="${itemId}"]`)).toHaveLength(1);
	});

	it("keeps the toolbar surface and actor stable while the active Board space changes", async () => {
		publishRuntime(
			RuntimeSchema.parse({
				...initialRuntime,
				items: initialRuntime.items.map((item) =>
					item.item.id === "water"
						? {
								...item,
								location: toolbar(0),
							}
						: item,
				),
			}),
		);
		await renderGameBoard();
		const toolbarGrid = document.querySelector<HTMLElement>('[data-ui="ToolbarGrid"]');
		const actor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-item-id="water"]',
		);
		if (toolbarGrid === null || actor === null) throw new Error("Missing toolbar scene.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					currentSpace: 7,
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="ToolbarGrid"]')).toBe(toolbarGrid);
		expect(document.querySelector(`[data-runtime-id="${actor.dataset.runtimeId}"]`)).toBe(
			actor,
		);
		expect(toolbarGrid.dataset.tileSurfaceId).toBe("toolbar");
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(
			document.querySelector<HTMLElement>('[data-ui="BoardGrid"]')?.dataset.tileSurfaceId,
		).toBe("board:7");
	});

	it("reorders occupied toolbar slots through the same swap target contract", async () => {
		publishRuntime(
			RuntimeSchema.parse({
				...initialRuntime,
				items: initialRuntime.items.map((item) => ({
					...item,
					location: item.item.id === "water" ? toolbar(0) : toolbar(1),
				})),
			}),
		);
		await renderGameBoard();
		const source = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-item-id="water"]',
		);
		const target = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-item-id="stone"]',
		);
		if (source === null || target === null) throw new Error("Missing toolbar actors.");
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
			throw new Error("Missing toolbar actor identities.");
		}
		dropItemState.drop.mockImplementation(async () => {
			const sourceNextRevision = "revision:toolbar-source-swapped";
			const targetNextRevision = "revision:toolbar-target-swapped";
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((item) => {
						if (item.id === sourceId) {
							return {
								...item,
								revision: sourceNextRevision,
								location: toolbar(1),
							};
						}
						if (item.id === targetId) {
							return {
								...item,
								revision: targetNextRevision,
								location: toolbar(0),
							};
						}
						return item;
					}),
				}),
			);
			return {
				kind: DropItemResultKindEnumSchema.enum.Swap,
				source: {
					itemId: sourceId,
					revision: sourceNextRevision,
					previousLocation: toolbar(0),
					location: toolbar(1),
				},
				target: {
					itemId: targetId,
					revision: targetNextRevision,
					previousLocation: toolbar(1),
					location: toolbar(0),
				},
			};
		});

		await drag({
			actor: source,
			from: [
				50,
				270,
			],
			to: [
				150,
				270,
			],
		});

		expect(dropItemState.drop).toHaveBeenCalledWith({
			sourceItemId: sourceId,
			sourceRevision,
			sourceLocation: toolbar(0),
			target: {
				kind: "slot",
				location: toolbar(1),
				occupant: {
					itemId: targetId,
					revision: targetRevision,
				},
			},
		});
		expect(document.querySelector(`[data-runtime-id="${sourceId}"]`)).toBe(source);
		expect(document.querySelector(`[data-runtime-id="${targetId}"]`)).toBe(target);
		expect(source.dataset.toolbarX).toBe("1");
		expect(target.dataset.toolbarX).toBe("0");
	});
	it("opens the same Item Detail modal from an exact Toolbar actor", async () => {
		await renderGameBoard();
		const actor = document.querySelector<HTMLElement>(
			'[data-ui="TileActor"][data-location-scope="toolbar"]',
		);
		if (actor === null) throw new Error("Missing Toolbar actor.");
		const itemId = actor.dataset.runtimeId;
		if (itemId === undefined) throw new Error("Missing Toolbar actor identity.");

		await act(async () => {
			actor.dispatchEvent(
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
		expect(modal?.dataset.runtimeId).toBe(itemId);
		expect(modal?.dataset.tab).toBe("info");
		expect(document.querySelectorAll('[data-ui="ItemDetailModal"]')).toHaveLength(1);
	});
});
