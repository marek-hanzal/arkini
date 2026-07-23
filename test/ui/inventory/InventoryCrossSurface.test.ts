// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
import type { InventoryControl } from "~/ui/inventory/InventoryControl";
import { InventoryHost } from "~/ui/inventory/InventoryHost";
import { InventoryProvider } from "~/ui/inventory/InventoryProvider";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
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

const board = (x: number, y: number, space = 0) => ({
	scope: "board" as const,
	space,
	position: {
		x,
		y,
	},
});
const inventory = (x: number, y: number) => ({
	scope: "inventory" as const,
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
		id: "game:inventory-cross-surface",
		title: "Inventory cross-surface",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 3,
			height: 2,
		},
		toolbarSize: 2,
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "backpack",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "copper",
				space: 0,
				x: 1,
				y: 1,
			},
		],
		inventory: [
			{
				itemId: "water",
				quantity: 4,
			},
			{
				itemId: "stone",
			},
		],
		toolbar: [
			{
				itemId: "water",
				position: {
					x: 0,
					y: 0,
				},
			},
		],
	},
	categories: {},
	items: {
		backpack: {
			id: "backpack",
			type: "inventory",
			title: "Backpack",
			description: "Opens the shared Inventory.",
			asset: {
				source: [
					"asset:backpack",
				],
			},
			tags: [],
			categoryId: "utility",
		},
		copper: {
			id: "copper",
			type: "simple",
			title: "Copper",
			description: "Copper",
			asset: {
				source: [
					"asset:copper",
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

const startedRuntime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
const initialRuntime = RuntimeSchema.parse({
	...startedRuntime,
	items: startedRuntime.items.map((item) =>
		item.item.id === "water" && item.location.scope === "toolbar"
			? {
					...item,
					quantity: 8,
				}
			: item,
	),
});

let currentRuntime = initialRuntime;
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

const runtimeItem = (itemId: string, scope: "board" | "inventory" | "toolbar") => {
	const item = currentRuntime.items.find(
		(candidate) => candidate.item.id === itemId && candidate.location.scope === scope,
	);
	if (item === undefined) throw new Error(`Missing ${scope} ${itemId}.`);
	return item;
};

const actorByRuntimeId = (runtimeId: string) => {
	const actor = document.querySelector<HTMLElement>(
		`[data-ui="TileActor"][data-runtime-id="${runtimeId}"]`,
	);
	if (actor === null) throw new Error(`Missing actor ${runtimeId}.`);
	return actor;
};

const actorCellRect = (runtimeId: string) => {
	const item = currentRuntime.items.find((candidate) => candidate.id === runtimeId);
	if (item === undefined) return null;
	if (item.location.scope === "board") {
		return rect(item.location.position.x * 100, item.location.position.y * 100, 100, 100);
	}
	if (item.location.scope === "toolbar") {
		return rect(item.location.position.x * 100, 220, 100, 100);
	}
	if (item.location.scope === "inventory") {
		return rect(300 + item.location.position.x * 100, item.location.position.y * 100, 100, 100);
	}
	return null;
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
			if (element.dataset.ui === "InventoryGrid") return rect(300, 0, 300, 200);
			if (element.dataset.ui === "TileActorLayer") return rect(0, 0, 600, 320);
			if (
				element.dataset.ui === "TileMotionCueVisual" ||
				element.dataset.ui === "TileActorVisual" ||
				element.dataset.ui === "TileActorDragSurface"
			) {
				const actor = element.closest<HTMLElement>('[data-ui="TileActor"]');
				const runtimeId = actor?.dataset.runtimeId;
				if (runtimeId !== undefined) return actorCellRect(runtimeId) ?? rect(0, 0, 0, 0);
			}
			if (element.dataset.ui === "BoardCell") {
				return rect(
					Number(element.dataset.boardX) * 100,
					Number(element.dataset.boardY) * 100,
					100,
					100,
				);
			}
			if (element.dataset.ui === "ToolbarCell") {
				return rect(Number(element.dataset.toolbarX) * 100, 220, 100, 100);
			}
			if (element.dataset.ui === "InventoryCell") {
				return rect(
					300 + Number(element.dataset.tileX) * 100,
					Number(element.dataset.tileY) * 100,
					100,
					100,
				);
			}
			return rect(0, 0, 0, 0);
		},
	});
	Object.defineProperty(document, "elementsFromPoint", {
		configurable: true,
		value: vi.fn((x: number, y: number) => {
			if (x >= 300 && x < 600 && y >= 0 && y < 200) {
				const inventoryX = Math.floor((x - 300) / 100);
				const inventoryY = Math.floor(y / 100);
				const cell = document.querySelector(
					`[data-ui="InventoryCell"][data-tile-x="${inventoryX}"][data-tile-y="${inventoryY}"]`,
				);
				return cell === null
					? []
					: [
							cell,
						];
			}
			if (x >= 0 && x < 200 && y >= 220 && y < 320) {
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
			if (x >= 0 && x < 200 && y >= 0 && y < 200) {
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

const ControlProbe = ({
	onControl,
}: {
	readonly onControl: (control: InventoryControl) => void;
}) => {
	const control = useInventoryControl();
	useEffect(
		() => onControl(control),
		[
			control,
			onControl,
		],
	);
	return null;
};

const renderScene = async () => {
	let control: InventoryControl | undefined;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ItemDetailProvider,
				null,
				createElement(
					InventoryProvider,
					null,
					createElement(ControlProbe, {
						onControl: (next) => {
							control = next;
						},
					}),
					createElement(
						TileSystemProvider,
						null,
						createElement(GameBoardLayout),
						createElement(InventoryHost),
					),
				),
			),
		);
		await Promise.resolve();
	});
	const readControl = () => {
		if (control === undefined) throw new Error("Missing Inventory control.");
		return control;
	};
	await act(async () => {
		readControl().open();
		await Promise.resolve();
	});
	return {
		readControl,
	};
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

describe("Inventory cross-surface tile scene", () => {
	it("moves one real actor Board to Inventory to Toolbar without a clone", async () => {
		await renderScene();
		const item = runtimeItem("copper", "board");
		const actor = actorByRuntimeId(item.id);
		const firstRevision = "revision:copper-inventory";
		const secondRevision = "revision:copper-toolbar";
		dropItemState.drop
			.mockImplementationOnce(async () => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						items: currentRuntime.items.map((candidate) =>
							candidate.id === item.id
								? {
										...candidate,
										revision: firstRevision,
										location: inventory(2, 0),
									}
								: candidate,
						),
					}),
				);
				return {
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId: item.id,
					revision: firstRevision,
					previousLocation: board(1, 1),
					location: inventory(2, 0),
				};
			})
			.mockImplementationOnce(async () => {
				publishRuntime(
					RuntimeSchema.parse({
						...currentRuntime,
						items: currentRuntime.items.map((candidate) =>
							candidate.id === item.id
								? {
										...candidate,
										revision: secondRevision,
										location: toolbar(1),
									}
								: candidate,
						),
					}),
				);
				return {
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId: item.id,
					revision: secondRevision,
					previousLocation: inventory(2, 0),
					location: toolbar(1),
				};
			});

		await drag({
			actor,
			from: [
				150,
				150,
			],
			to: [
				550,
				50,
			],
		});

		expect(dropItemState.drop).toHaveBeenNthCalledWith(1, {
			sourceItemId: item.id,
			sourceRevision: item.revision,
			sourceLocation: board(1, 1),
			target: {
				kind: "slot",
				location: inventory(2, 0),
				occupant: null,
			},
		});
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("inventory");
		expect(actor.dataset.surfaceId).toBe("inventory");

		await drag({
			actor,
			from: [
				550,
				50,
			],
			to: [
				150,
				270,
			],
		});

		expect(dropItemState.drop).toHaveBeenNthCalledWith(2, {
			sourceItemId: item.id,
			sourceRevision: firstRevision,
			sourceLocation: inventory(2, 0),
			target: {
				kind: "slot",
				location: toolbar(1),
				occupant: null,
			},
		});
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(actor.dataset.toolbarX).toBe("1");
		expect(document.querySelectorAll(`[data-runtime-id="${item.id}"]`)).toHaveLength(1);
		expect(document.querySelector('[data-ui="TileDragGhost"]')).toBeNull();
	});

	it("moves the Backpack while Inventory stays open and preserves both identities", async () => {
		await renderScene();
		const item = runtimeItem("backpack", "board");
		const actor = actorByRuntimeId(item.id);
		const inventoryGrid = document.querySelector<HTMLElement>('[data-ui="InventoryGrid"]');
		if (inventoryGrid === null) throw new Error("Missing open Inventory grid.");
		const revision = "revision:backpack-toolbar";
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((candidate) =>
						candidate.id === item.id
							? {
									...candidate,
									revision,
									location: toolbar(1),
								}
							: candidate,
					),
				}),
			);
			return {
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: item.id,
				revision,
				previousLocation: board(0, 0),
				location: toolbar(1),
			};
		});

		await drag({
			actor,
			from: [
				50,
				50,
			],
			to: [
				150,
				270,
			],
		});

		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(document.querySelector('[data-ui="InventoryGrid"]')).toBe(inventoryGrid);
		expect(document.querySelectorAll('[data-ui="InventoryHost"]')).toHaveLength(1);
		expect(document.querySelectorAll(`[data-runtime-id="${item.id}"]`)).toHaveLength(1);
	});

	it("swaps occupied Inventory slots without remounting either actor", async () => {
		await renderScene();
		const sourceItem = runtimeItem("water", "inventory");
		const targetItem = runtimeItem("stone", "inventory");
		const source = actorByRuntimeId(sourceItem.id);
		const target = actorByRuntimeId(targetItem.id);
		const sourceRevision = "revision:water-swapped";
		const targetRevision = "revision:stone-swapped";
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((candidate) => {
						if (candidate.id === sourceItem.id) {
							return {
								...candidate,
								revision: sourceRevision,
								location: inventory(1, 0),
							};
						}
						if (candidate.id === targetItem.id) {
							return {
								...candidate,
								revision: targetRevision,
								location: inventory(0, 0),
							};
						}
						return candidate;
					}),
				}),
			);
			return {
				kind: DropItemResultKindEnumSchema.enum.Swap,
				source: {
					itemId: sourceItem.id,
					revision: sourceRevision,
					previousLocation: inventory(0, 0),
					location: inventory(1, 0),
				},
				target: {
					itemId: targetItem.id,
					revision: targetRevision,
					previousLocation: inventory(1, 0),
					location: inventory(0, 0),
				},
			};
		});

		await drag({
			actor: source,
			from: [
				350,
				50,
			],
			to: [
				450,
				50,
			],
		});

		expect(dropItemState.drop).toHaveBeenCalledWith({
			sourceItemId: sourceItem.id,
			sourceRevision: sourceItem.revision,
			sourceLocation: inventory(0, 0),
			target: {
				kind: "slot",
				location: inventory(1, 0),
				occupant: {
					itemId: targetItem.id,
					revision: targetItem.revision,
				},
			},
		});
		expect(actorByRuntimeId(sourceItem.id)).toBe(source);
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(document.querySelectorAll(`[data-runtime-id="${sourceItem.id}"]`)).toHaveLength(1);
		expect(document.querySelectorAll(`[data-runtime-id="${targetItem.id}"]`)).toHaveLength(1);
	});

	it("keeps the partial stack remainder and target on their exact cross-surface actors", async () => {
		await renderScene();
		const sourceItem = runtimeItem("water", "inventory");
		const targetItem = runtimeItem("water", "toolbar");
		const source = actorByRuntimeId(sourceItem.id);
		const target = actorByRuntimeId(targetItem.id);
		const sourceRevision = "revision:water-remainder";
		const targetRevision = "revision:water-full";
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((candidate) => {
						if (candidate.id === sourceItem.id) {
							return {
								...candidate,
								revision: sourceRevision,
								quantity: 2,
							};
						}
						if (candidate.id === targetItem.id) {
							return {
								...candidate,
								revision: targetRevision,
								quantity: 10,
							};
						}
						return candidate;
					}),
				}),
			);
			return {
				kind: DropItemResultKindEnumSchema.enum.Stack,
				transferredQuantity: 2,
				source: {
					itemId: sourceItem.id,
					canonicalItemId: "water",
					previousRevision: sourceItem.revision,
					previousLocation: inventory(0, 0),
					previousQuantity: 4,
					current: {
						itemId: sourceItem.id,
						canonicalItemId: "water",
						revision: sourceRevision,
						location: inventory(0, 0),
						quantity: 2,
					},
				},
				target: {
					itemId: targetItem.id,
					canonicalItemId: "water",
					previousRevision: targetItem.revision,
					previousLocation: toolbar(0),
					previousQuantity: 8,
					current: {
						itemId: targetItem.id,
						canonicalItemId: "water",
						revision: targetRevision,
						location: toolbar(0),
						quantity: 10,
					},
				},
			};
		});

		await drag({
			actor: source,
			from: [
				350,
				50,
			],
			to: [
				50,
				270,
			],
		});

		expect(actorByRuntimeId(sourceItem.id)).toBe(source);
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(source.querySelector('[data-ui="TileActorQuantity"]')?.textContent).toBe("2");
		expect(target.querySelector('[data-ui="TileActorQuantity"]')?.textContent).toBe("10");
		expect(source.dataset.locationScope).toBe("inventory");
		expect(target.dataset.locationScope).toBe("toolbar");
		expect(document.querySelectorAll(`[data-runtime-id="${sourceItem.id}"]`)).toHaveLength(1);
		expect(document.querySelectorAll(`[data-runtime-id="${targetItem.id}"]`)).toHaveLength(1);
	});

	it("preserves a full Stack approach and impact after Inventory closes while pending", async () => {
		motionTestRuntime.autoComplete = false;
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		const initialSource = runtimeItem("water", "inventory");
		currentRuntime = RuntimeSchema.parse({
			...currentRuntime,
			items: currentRuntime.items.map((candidate) =>
				candidate.id === initialSource.id
					? {
							...candidate,
							quantity: 2,
						}
					: candidate,
			),
		});
		currentTransition = {
			sequence: transitionSequence,
			previousRuntime: null,
			runtime: currentRuntime,
			events: [],
		};
		const { readControl } = await renderScene();
		const sourceItem = runtimeItem("water", "inventory");
		const targetItem = runtimeItem("water", "toolbar");
		const source = actorByRuntimeId(sourceItem.id);
		const target = actorByRuntimeId(targetItem.id);
		const targetRevision = "revision:water-full-after-close";
		let resolveDrop: ((outcome: dropItemFx.Result) => void) | undefined;
		dropItemState.drop.mockImplementation(
			() =>
				new Promise<dropItemFx.Result>((resolve) => {
					resolveDrop = resolve;
				}),
		);

		await drag({
			actor: source,
			from: [
				350,
				50,
			],
			to: [
				50,
				270,
			],
		});
		expect(source.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			readControl().close({
				restoreFocus: false,
			});
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(actorByRuntimeId(sourceItem.id)).toBe(source);
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(source.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.flatMap((candidate) => {
						if (candidate.id === sourceItem.id) return [];
						return candidate.id === targetItem.id
							? [
									{
										...candidate,
										revision: targetRevision,
										quantity: 10,
									},
								]
							: [
									candidate,
								];
					}),
				}),
			);
			resolveDrop?.({
				kind: DropItemResultKindEnumSchema.enum.Stack,
				transferredQuantity: 2,
				source: {
					itemId: sourceItem.id,
					canonicalItemId: "water",
					previousRevision: sourceItem.revision,
					previousLocation: inventory(0, 0),
					previousQuantity: 2,
					current: null,
				},
				target: {
					itemId: targetItem.id,
					canonicalItemId: "water",
					previousRevision: targetItem.revision,
					previousLocation: toolbar(0),
					previousQuantity: 8,
					current: {
						itemId: targetItem.id,
						canonicalItemId: "water",
						revision: targetRevision,
						location: toolbar(0),
						quantity: 10,
					},
				},
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(actorByRuntimeId(sourceItem.id)).toBe(source);
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(source.dataset.live).toBe("false");
		expect(source.dataset.motionPhase).toBe("combining");
		expect(target.dataset.motionPhase).toBe("combining");
		expect(document.querySelectorAll(`[data-runtime-id="${sourceItem.id}"]`)).toHaveLength(1);
		expect(document.querySelectorAll(`[data-runtime-id="${targetItem.id}"]`)).toHaveLength(1);

		await act(async () => {
			for (const animation of motionTestRuntime.imperativeAnimations) {
				animation.finish();
			}
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(actorByRuntimeId(sourceItem.id)).toBe(source);
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(source.dataset.motionPhase).toBe("exiting");
		expect(target.dataset.motionPhase).toBe("impact");
		expect(target.querySelector('[data-ui="TileActorQuantity"]')?.textContent).toBe("10");

		await act(async () => {
			motionTestRuntime.finish(...motionTestRuntime.completions.map((_, index) => index));
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(document.querySelector(`[data-runtime-id="${sourceItem.id}"]`)).toBeNull();
		expect(actorByRuntimeId(targetItem.id)).toBe(target);
		expect(document.querySelectorAll(`[data-runtime-id="${targetItem.id}"]`)).toHaveLength(1);
	});

	it("cancels an Inventory drag on close and reuses the actor after reopen", async () => {
		const { readControl } = await renderScene();
		const item = runtimeItem("water", "inventory");
		const actor = actorByRuntimeId(item.id);
		const dragSurface = actor.querySelector<HTMLElement>('[data-ui="TileActorDragSurface"]');
		if (dragSurface === null) throw new Error("Missing Inventory drag surface.");

		await act(async () => {
			dragSurface.dispatchEvent(pointerEvent("pointerdown", 350, 50));
			dragSurface.dispatchEvent(pointerEvent("pointermove", 250, 50));
			await Promise.resolve();
		});
		expect(actor.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			readControl().close({
				restoreFocus: false,
			});
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(dropItemState.drop).not.toHaveBeenCalled();
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.motionPhase).toBe("stable");
		expect(actor.style.visibility).toBe("hidden");

		await act(async () => {
			readControl().open();
			await Promise.resolve();
		});

		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.style.visibility).toBe("visible");
		expect(document.querySelectorAll(`[data-runtime-id="${item.id}"]`)).toHaveLength(1);
	});

	it("finishes a pending cross-surface move after close and survives reopen", async () => {
		const { readControl } = await renderScene();
		const item = runtimeItem("water", "inventory");
		const actor = actorByRuntimeId(item.id);
		const revision = "revision:pending-toolbar";
		let resolveDrop: ((outcome: dropItemFx.Result) => void) | undefined;
		dropItemState.drop.mockImplementation(
			() =>
				new Promise<dropItemFx.Result>((resolve) => {
					resolveDrop = resolve;
				}),
		);

		await drag({
			actor,
			from: [
				350,
				50,
			],
			to: [
				150,
				270,
			],
		});
		expect(dropItemState.drop).toHaveBeenCalledOnce();
		expect(actor.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			readControl().close({
				restoreFocus: false,
			});
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.motionPhase).toBe("dragging");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((candidate) =>
						candidate.id === item.id
							? {
									...candidate,
									revision,
									location: toolbar(1),
								}
							: candidate,
					),
				}),
			);
			resolveDrop?.({
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: item.id,
				revision,
				previousLocation: inventory(0, 0),
				location: toolbar(1),
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(actor.dataset.toolbarX).toBe("1");

		await act(async () => {
			readControl().open();
			await Promise.resolve();
		});
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(document.querySelectorAll(`[data-runtime-id="${item.id}"]`)).toHaveLength(1);
	});

	it("keeps one settling actor alive while Inventory closes and reopens", async () => {
		motionTestRuntime.autoComplete = false;
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		const { readControl } = await renderScene();
		const item = runtimeItem("stone", "inventory");
		const actor = actorByRuntimeId(item.id);
		const revision = "revision:settling-toolbar";
		dropItemState.drop.mockImplementation(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					items: currentRuntime.items.map((candidate) =>
						candidate.id === item.id
							? {
									...candidate,
									revision,
									location: toolbar(1),
								}
							: candidate,
					),
				}),
			);
			return {
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: item.id,
				revision,
				previousLocation: inventory(1, 0),
				location: toolbar(1),
			};
		});

		await drag({
			actor,
			from: [
				450,
				50,
			],
			to: [
				150,
				270,
			],
		});
		expect(actor.dataset.motionPhase).toBe("settling");

		await act(async () => {
			readControl().close({
				restoreFocus: false,
			});
			await Promise.resolve();
		});
		expect(document.querySelector('[data-ui="InventoryHost"]')).toBeNull();
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(actor.dataset.locationScope).toBe("toolbar");
		expect(actor.dataset.motionPhase).toBe("settling");

		await act(async () => {
			readControl().open();
			await Promise.resolve();
		});
		expect(actorByRuntimeId(item.id)).toBe(actor);
		expect(document.querySelectorAll(`[data-runtime-id="${item.id}"]`)).toHaveLength(1);

		await act(async () => {
			for (const animation of motionTestRuntime.imperativeAnimations) {
				animation.finish();
			}
			await Promise.resolve();
			motionTestRuntime.finish(...motionTestRuntime.completions.map((_, index) => index));
			await Promise.resolve();
		});
		expect(actor.dataset.motionPhase).toBe("stable");
	});

	it("keeps Inventory and global actors stable across active Board space changes", async () => {
		await renderScene();
		const inventoryItem = runtimeItem("water", "inventory");
		const toolbarItem = runtimeItem("water", "toolbar");
		const backpack = runtimeItem("backpack", "board");
		const inventoryActor = actorByRuntimeId(inventoryItem.id);
		const toolbarActor = actorByRuntimeId(toolbarItem.id);
		const backpackActor = actorByRuntimeId(backpack.id);
		const inventoryGrid = document.querySelector<HTMLElement>('[data-ui="InventoryGrid"]');
		if (inventoryGrid === null) throw new Error("Missing open Inventory grid.");

		await act(async () => {
			publishRuntime(
				RuntimeSchema.parse({
					...currentRuntime,
					currentSpace: 7,
				}),
			);
			await Promise.resolve();
		});

		expect(document.querySelector('[data-ui="InventoryGrid"]')).toBe(inventoryGrid);
		expect(actorByRuntimeId(inventoryItem.id)).toBe(inventoryActor);
		expect(actorByRuntimeId(toolbarItem.id)).toBe(toolbarActor);
		expect(actorByRuntimeId(backpack.id)).toBe(backpackActor);
		expect(inventoryActor.style.visibility).toBe("visible");
		expect(toolbarActor.style.visibility).toBe("visible");
		expect(backpackActor.style.visibility).toBe("hidden");
		expect(
			document.querySelector<HTMLElement>('[data-ui="BoardGrid"]')?.dataset.tileSurfaceId,
		).toBe("board:7");
		expect(document.querySelectorAll('[data-ui="TileActorLayer"]')).toHaveLength(1);
	});
});
