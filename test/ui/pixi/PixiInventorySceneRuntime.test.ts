// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiMainSceneLayoutFx } from "~/ui/pixi/layout/readPixiMainSceneLayoutFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import { createPixiInventorySceneRuntimeFx } from "~/ui/pixi/scene/createPixiInventorySceneRuntimeFx";

interface FakePointerEvent {
	readonly button: number;
	readonly global: {
		readonly x: number;
		readonly y: number;
	};
	readonly isPrimary: boolean;
	readonly pointerId: number;
	readonly shiftKey: boolean;
	readonly stopPropagation: () => void;
}

interface FakeContainer {
	children: FakeContainer[];
	destroyed: boolean;
	eventMode: string;
	hitArea: unknown;
	mask: unknown;
	x: number;
	y: number;
	zIndex: number;
	addChild: (...children: FakeContainer[]) => void;
	destroy: (options?: { readonly children?: boolean }) => void;
	emit: (event: string, payload: FakePointerEvent) => void;
	off: (event: string, listener: (payload: FakePointerEvent) => void) => void;
	on: (event: string, listener: (payload: FakePointerEvent) => void) => void;
}

type GameTransition = ReturnType<GameEngine["getTransitionSnapshot"]>;

const sceneState = vi.hoisted(() => ({
	actors: [] as PixiTileActor[],
	close: vi.fn(),
	createContainer: undefined as (() => FakeContainer) | undefined,
	drop: vi.fn(),
	items: [] as TileActorItem[],
	owner: null as PixiApplicationOwner | null,
	preview: vi.fn(),
	resize: null as (() => void) | null,
	roundRects: 0,
	transition: null as GameTransition | null,
	transitionListener: null as ((transition: GameTransition) => void) | null,
}));

vi.mock("pixi.js", () => {
	class Container implements FakeContainer {
		children: FakeContainer[] = [];
		destroyed = false;
		eventMode = "auto";
		hitArea: unknown = null;
		mask: unknown = null;
		x = 0;
		y = 0;
		zIndex = 0;
		private readonly listeners = new Map<string, Set<(payload: FakePointerEvent) => void>>();

		addChild(...children: FakeContainer[]) {
			this.children.push(...children);
		}

		destroy(options?: { readonly children?: boolean }) {
			this.destroyed = true;
			if (options?.children === true) {
				for (const child of this.children) child.destroy(options);
			}
			this.children.length = 0;
			this.listeners.clear();
		}

		emit(event: string, payload: FakePointerEvent) {
			for (const listener of this.listeners.get(event) ?? []) listener(payload);
		}

		off(event: string, listener: (payload: FakePointerEvent) => void) {
			this.listeners.get(event)?.delete(listener);
		}

		on(event: string, listener: (payload: FakePointerEvent) => void) {
			const listeners = this.listeners.get(event) ?? new Set();
			listeners.add(listener);
			this.listeners.set(event, listeners);
		}
	}

	class Graphics extends Container {
		readonly roundRects: Array<
			readonly [
				number,
				number,
				number,
				number,
				number,
			]
		> = [];

		clear() {
			return this;
		}

		fill(_value: unknown) {
			return this;
		}

		rect(_x: number, _y: number, _width: number, _height: number) {
			return this;
		}

		roundRect(x: number, y: number, width: number, height: number, radius: number) {
			sceneState.roundRects += 1;
			this.roundRects.push([
				x,
				y,
				width,
				height,
				radius,
			]);
			return this;
		}

		stroke(_value: unknown) {
			return this;
		}
	}

	class Rectangle {
		constructor(
			readonly x: number,
			readonly y: number,
			readonly width: number,
			readonly height: number,
		) {}
	}

	sceneState.createContainer = () => new Container();
	return {
		Container,
		Graphics,
		Rectangle,
	};
});

vi.mock("~/ui/pixi/runtime/createPixiApplicationOwnerFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiApplicationOwnerFx: ({ host }: { readonly host: HTMLElement }) =>
			EffectModule.sync(() => {
				const createContainer = sceneState.createContainer;
				if (createContainer === undefined) throw new Error("Pixi mock is not ready.");
				const stage = createContainer();
				const canvas = document.createElement("canvas");
				canvas.setPointerCapture = vi.fn();
				canvas.releasePointerCapture = vi.fn();
				canvas.getBoundingClientRect = () => ({
					bottom: 480,
					height: 480,
					left: 0,
					right: 800,
					toJSON: () => ({}),
					top: 0,
					width: 800,
					x: 0,
					y: 0,
				});
				host.replaceChildren(canvas);
				const owner = {
					app: {
						canvas,
						screen: {
							height: 480,
							width: 800,
						},
						stage,
					},
					stage,
					frames: {
						closeFx: EffectModule.void,
						invalidateFx: EffectModule.void,
					},
					addResizeListenerFx: (listener: () => void) =>
						EffectModule.sync(() => {
							sceneState.resize = listener;
							return () => {
								sceneState.resize = null;
							};
						}),
					closeFx: EffectModule.sync(sceneState.close),
				} as unknown as PixiApplicationOwner;
				sceneState.owner = owner;
				return owner;
			}),
	};
});

vi.mock("~/ui/pixi/appearance/readPixiScenePaletteFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readPixiScenePaletteFx: () =>
			EffectModule.succeed({
				accent: 0x00ff00,
				danger: 0xff0000,
				gridA: 0x111111,
				gridB: 0x222222,
				line: 0x333333,
				overlay: 0x444444,
				overlayForeground: 0xffffff,
				surface: 0x555555,
				toolbarA: 0x666666,
				toolbarB: 0x777777,
			}),
	};
});

vi.mock("~/bridge/tile/readTileActorsFx", () => ({
	readTileActorsFx: () => ({
		type: "tile-actors",
	}),
}));

vi.mock("~/bridge/tile/readTileDropPreviewFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readTileDropPreviewFx: (props: unknown) =>
			EffectModule.sync(() => {
				sceneState.preview(props);
				return {
					kind: "move",
				};
			}),
	};
});

vi.mock("~/ui/pixi/actor/createPixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiTileActorFx: ({ item }: { readonly item: TileActorItem }) =>
			EffectModule.sync(() => {
				const createContainer = sceneState.createContainer;
				if (createContainer === undefined) throw new Error("Pixi mock is not ready.");
				const actor = {
					container: createContainer(),
					item,
					size: 0,
					textureGeneration: 0,
					dragging: false,
					dragOffsetX: 0,
					dragOffsetY: 0,
					onPointerDown: null,
				} as unknown as PixiTileActor;
				sceneState.actors.push(actor);
				return actor;
			}),
	};
});

vi.mock("~/ui/pixi/actor/updatePixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updatePixiTileActorFx: ({
			actor,
			item,
			size,
		}: {
			readonly actor: PixiTileActor;
			readonly item: TileActorItem;
			readonly size: number;
		}) =>
			EffectModule.sync(() => {
				actor.item = item;
				actor.size = size;
			}),
	};
});

const inventoryItem = {
	compositeUrl: undefined,
	id: "runtime:water",
	itemId: "water",
	location: {
		scope: "inventory",
		position: {
			x: 0,
			y: 0,
		},
	},
	primaryAction: {
		kind: "none",
	},
	quantity: 4,
	revision: "revision:water",
	running: false,
	sourceUrl: "resource:water",
	title: "Water",
} satisfies TileActorItem;

const pointer = (x: number, y: number, shiftKey = false): FakePointerEvent => ({
	button: 0,
	global: {
		x,
		y,
	},
	isPrimary: true,
	pointerId: 1,
	shiftKey,
	stopPropagation: vi.fn(),
});

const flushMicrotasks = async () => {
	for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

const createGame = ({ subscribeError }: { readonly subscribeError?: Error } = {}) => {
	return {
		config: {
			meta: {
				board: {
					height: 7,
					width: 11,
				},
				inventory: {
					height: 4,
					width: 5,
				},
				title: "Inventory scene",
				toolbarSize: 8,
			},
		},
		getTransitionSnapshot: () => {
			const transition = sceneState.transition;
			if (transition === null) throw new Error("Test transition is missing.");
			return transition;
		},
		readOrThrow: () => sceneState.items,
		subscribeTransitions: (listener: (transition: GameTransition) => void) => {
			if (subscribeError !== undefined) throw subscribeError;
			sceneState.transitionListener = listener;
			return () => {
				if (sceneState.transitionListener === listener) {
					sceneState.transitionListener = null;
				}
			};
		},
	} as unknown as GameEngine;
};

const mountScene = async ({
	game = createGame(),
	onActivate = vi.fn(),
	onDrop = vi.fn((command: unknown) => {
		sceneState.drop(command);
		return Promise.resolve({
			kind: "move",
		} as never);
	}),
}: {
	readonly game?: GameEngine;
	readonly onActivate?: createPixiInventorySceneRuntimeFx.Props["onActivate"];
	readonly onDrop?: createPixiInventorySceneRuntimeFx.Props["onDrop"];
} = {}) => {
	const tileScene = document.createElement("div");
	tileScene.dataset.ui = "TileScene";
	Object.defineProperties(tileScene, {
		clientHeight: {
			value: 900,
		},
		clientWidth: {
			value: 1100,
		},
	});
	const host = document.createElement("div");
	tileScene.append(host);
	document.body.append(tileScene);
	const runtime = await Effect.runPromise(
		createPixiInventorySceneRuntimeFx({
			game,
			host,
			onActivate,
			onDrop,
			textures: {} as never,
		}),
	);
	const owner = sceneState.owner;
	const actor = sceneState.actors[0];
	if (owner === null || actor === undefined) throw new Error("Inventory scene did not mount.");
	return {
		actor,
		onActivate,
		onDrop,
		runtime,
		stage: owner.stage as unknown as FakeContainer,
	};
};

const moveInventoryItem = (x: number): TileActorItem => ({
	...inventoryItem,
	location: {
		scope: "inventory",
		position: {
			x,
			y: 0,
		},
	},
	revision: `revision:water:${x}`,
});

const publishItems = (items: readonly TileActorItem[], notify = true) => {
	const current = sceneState.transition;
	if (current === null) throw new Error("Test transition is missing.");
	const transition = {
		...current,
		previousRuntime: current.runtime,
		runtime: {
			currentSpace: 0,
		} as never,
		sequence: current.sequence + 1,
	} satisfies GameTransition;
	sceneState.items = [
		...items,
	];
	sceneState.transition = transition;
	if (notify) sceneState.transitionListener?.(transition);
};

beforeEach(() => {
	sceneState.actors.length = 0;
	sceneState.close.mockClear();
	sceneState.drop.mockClear();
	sceneState.items = [
		inventoryItem,
	];
	sceneState.owner = null;
	sceneState.preview.mockClear();
	sceneState.resize = null;
	sceneState.roundRects = 0;
	sceneState.transition = {
		events: [],
		previousRuntime: null,
		runtime: {
			currentSpace: 0,
		} as never,
		sequence: 0,
	};
	sceneState.transitionListener = null;
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("Pixi Inventory scene runtime", () => {
	it("uses the Board actor size and routes an ordinary click to Inventory activation", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const expectedBoardSize = Effect.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: 7,
				boardWidth: 11,
				height: 900,
				toolbarSize: 8,
				width: 1100,
			}),
		).board.cellSize;

		expect(actor.size).toBe(expectedBoardSize);
		expect(sceneState.roundRects).toBeGreaterThanOrEqual(3);
		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("pointerup", pointer(160, 60));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(onActivate).toHaveBeenCalledWith(
			inventoryItem,
			false,
			expect.any(HTMLCanvasElement),
			expect.objectContaining({
				size: expectedBoardSize,
			}),
		);
		expect(sceneState.drop).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("drags only between Inventory slots and commits the release through the engine bridge", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(280, 60));
		stage.emit("pointerup", pointer(280, 60));
		await Promise.resolve();
		await Promise.resolve();

		expect(onActivate).not.toHaveBeenCalled();
		expect(sceneState.preview).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: {
					kind: "slot",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					occupant: null,
				},
			}),
		);
		expect(sceneState.drop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				sourceLocation: inventoryItem.location,
				sourceRevision: inventoryItem.revision,
				target: {
					kind: "slot",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					occupant: null,
				},
			}),
		);
		expect(runtime.canvas.setPointerCapture).toHaveBeenCalledWith(1);
		expect(runtime.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(actor.container.x).not.toBe(initialX);
		await Effect.runPromise(runtime.closeFx);
	});

	it("keeps awaitingCommand exclusive and settles only a rejected drop", async () => {
		let resolveDrop: ((result: never) => void) | undefined;
		const onDrop = vi.fn(
			() =>
				new Promise<never>((resolve) => {
					resolveDrop = resolve;
				}),
		);
		const { actor, onActivate, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;
		const actorContainer = actor.container as unknown as FakeContainer;
		actorContainer.emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(280, 60));
		stage.emit("pointerup", pointer(280, 60));
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.x).not.toBe(initialX);
		Effect.runSync(runtime.cancelInteractionFx);
		expect(actor.container.x).not.toBe(initialX);
		actorContainer.emit("pointerdown", pointer(280, 60));
		stage.emit("pointerup", pointer(280, 60));
		expect(onDrop).toHaveBeenCalledOnce();
		expect(onActivate).not.toHaveBeenCalled();

		if (resolveDrop === undefined) throw new Error("Drop Promise was not created.");
		resolveDrop({
			kind: "reject",
		} as never);
		await flushMicrotasks();

		expect(actor.container.x).toBe(initialX);
		await Effect.runPromise(runtime.closeFx);
	});

	it("holds the released actor through an early transition and reconciles it after acceptance", async () => {
		let resolveDrop: ((result: never) => void) | undefined;
		const onDrop = vi.fn(
			() =>
				new Promise<never>((resolve) => {
					resolveDrop = resolve;
				}),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(330, 60));
		stage.emit("pointerup", pointer(330, 60));
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		const releasedX = actor.container.x;
		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.dragging).toBe(true);
		expect(actor.container.x).toBe(releasedX);
		expect(actor.container.x).not.toBe(initialX + 120);

		if (resolveDrop === undefined) throw new Error("Drop Promise was not created.");
		resolveDrop({
			kind: "move",
		} as never);
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX + 120);
		await Effect.runPromise(runtime.closeFx);
	});

	it("settles against the current snapshot when acceptance precedes its transition", async () => {
		const { actor, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(330, 60));
		stage.emit("pointerup", pointer(330, 60));
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX);

		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.container.x).toBe(initialX + 120);
		await Effect.runPromise(runtime.closeFx);
	});

	it("cancels one active gesture through the shared interaction owner", async () => {
		const { actor, onActivate, onDrop, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(280, 60));
		expect(actor.container.x).not.toBe(initialX);

		Effect.runSync(runtime.cancelInteractionFx);

		expect(actor.container.x).toBe(initialX);
		expect(runtime.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
		stage.emit("pointerup", pointer(280, 60));
		expect(onDrop).not.toHaveBeenCalled();
		expect(onActivate).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("does not invoke deferred activation or drop callbacks after the scene closes", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", pointer(160, 60));
		stage.emit("pointerup", pointer(160, 60));
		Effect.runSync(runtime.closeFx);
		await flushMicrotasks();
		expect(onActivate).not.toHaveBeenCalled();

		const second = await mountScene();
		const secondActorContainer = second.actor.container as unknown as FakeContainer;
		secondActorContainer.emit("pointerdown", pointer(160, 60));
		second.stage.emit("globalpointermove", pointer(280, 60));
		second.stage.emit("pointerup", pointer(280, 60));
		Effect.runSync(second.runtime.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).not.toHaveBeenCalled();
	});

	it("closes normally exactly once", async () => {
		const { actor, runtime } = await mountScene();

		await Effect.runPromise(runtime.closeFx);
		await Effect.runPromise(runtime.closeFx);

		expect(sceneState.close).toHaveBeenCalledOnce();
		expect(sceneState.resize).toBeNull();
		expect(sceneState.transitionListener).toBeNull();
		expect((actor.container as unknown as FakeContainer).destroyed).toBe(true);
	});

	it("rolls back acquired owners and listeners when late initialization fails", async () => {
		const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");

		await expect(
			mountScene({
				game: createGame({
					subscribeError: new Error("subscription failed"),
				}),
			}),
		).rejects.toThrow("subscription failed");

		expect(sceneState.close).toHaveBeenCalledOnce();
		expect(sceneState.resize).toBeNull();
		expect(disconnect).toHaveBeenCalledOnce();
		expect(sceneState.actors).toHaveLength(1);
		expect((sceneState.actors[0]?.container as unknown as FakeContainer).destroyed).toBe(true);
	});

	it("isolates synchronous activation failures and releases exact actor ownership", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const onActivate = vi.fn(() => {
			throw new Error("activation failed");
		});
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", pointer(160, 60));
		stage.emit("pointerup", pointer(160, 60));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		actorContainer.emit("pointerdown", pointer(160, 60));
		stage.emit("pointerup", pointer(160, 60));
		await Promise.resolve();
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledTimes(2);
		expect(error).toHaveBeenCalledWith("Pixi Inventory activation failed.", expect.any(Error));
		await Effect.runPromise(runtime.closeFx);
	});

	it("isolates synchronous drop failures and settles the released actor", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const onDrop = vi.fn(() => {
			throw new Error("drop failed");
		});
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;

		(actor.container as unknown as FakeContainer).emit("pointerdown", pointer(160, 60));
		stage.emit("globalpointermove", pointer(280, 60));
		stage.emit("pointerup", pointer(280, 60));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.x).toBe(initialX);
		expect(error).toHaveBeenCalledWith("Pixi Inventory drop failed.", expect.any(Error));
		await Effect.runPromise(runtime.closeFx);
	});
});
