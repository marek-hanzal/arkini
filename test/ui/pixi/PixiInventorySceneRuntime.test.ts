// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { pixiTileActorConsumedSourceFadeDurationMs } from "~/ui/pixi/animation/flashPixiTileActorConsumedSourceFx";
import { pixiTileActorFeedbackParticlesDurationMs } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { pixiTileActorLifecycleDurationMs } from "~/ui/pixi/animation/runPixiTileActorLifecycleFx";
import { readPixiInventorySceneLayoutFx } from "~/ui/pixi/layout/readPixiInventorySceneLayoutFx";
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
	alpha: number;
	children: FakeContainer[];
	cursor: string;
	destroyed: boolean;
	eventMode: string;
	hitArea: unknown;
	mask: unknown;
	pivot: {
		x: number;
		y: number;
		set: (x: number, y?: number) => void;
	};
	scale: {
		x: number;
		y: number;
		set: (x: number, y?: number) => void;
	};
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
	deferredTweenDurations: new Set<number>(),
	drop: vi.fn(),
	particleTextureClose: vi.fn(),
	particleTextures: {
		star: {
			kind: "activity-particle-star",
		},
	},
	items: [] as TileActorItem[],
	owner: null as PixiApplicationOwner | null,
	preview: vi.fn(),
	pendingTweenCompletions: [] as Array<() => void>,
	resize: null as (() => void) | null,
	roundRects: 0,
	transition: null as GameTransition | null,
	transitionListener: null as ((transition: GameTransition) => void) | null,
}));

vi.mock("pixi.js", () => {
	class Container implements FakeContainer {
		alpha = 1;
		children: FakeContainer[] = [];
		cursor = "default";
		destroyed = false;
		eventMode = "auto";
		hitArea: unknown = null;
		mask: unknown = null;
		pivot = {
			x: 0,
			y: 0,
			set: (x: number, y = x) => {
				this.pivot.x = x;
				this.pivot.y = y;
			},
		};
		scale = {
			x: 1,
			y: 1,
			set: (x: number, y = x) => {
				this.scale.x = x;
				this.scale.y = y;
			},
		};
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

vi.mock("~/ui/pixi/actor/createPixiTileActorParticleTexturesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiTileActorParticleTexturesFx: () =>
			EffectModule.succeed({
				closeFx: EffectModule.sync(sceneState.particleTextureClose),
				...sceneState.particleTextures,
			}),
	};
});

vi.mock("~/ui/pixi/animation/createPixiAnimationDriverFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiAnimationDriverFx: () =>
			EffectModule.succeed({
				closeFx: EffectModule.void,
				createSpringFx: ({
					initialValue,
					onUpdate,
				}: {
					readonly initialValue: number;
					readonly onUpdate: (value: number) => void;
				}) =>
					EffectModule.sync(() => {
						onUpdate(initialValue);
						return {
							closeFx: EffectModule.void,
							setTargetFx: (value: number) =>
								EffectModule.sync(() => onUpdate(value)),
						};
					}),
				startTweenFx: ({
					durationMs,
					onComplete,
					onUpdate,
					to,
				}: {
					readonly durationMs: number;
					readonly onComplete?: () => void;
					readonly onUpdate: (value: number) => void;
					readonly to: number;
				}) =>
					EffectModule.sync(() => {
						const deferred =
							durationMs === 1_760 ||
							sceneState.deferredTweenDurations.has(durationMs);
						onUpdate(
							durationMs === 1_760 ||
								durationMs === pixiTileActorFeedbackParticlesDurationMs
								? 0.5
								: to,
						);
						let active = true;
						const complete = () => {
							if (!active) return;
							active = false;
							onComplete?.();
						};
						if (deferred) {
							sceneState.pendingTweenCompletions.push(complete);
						} else {
							complete();
						}
						return {
							stopFx: EffectModule.sync(() => {
								active = false;
							}),
						};
					}),
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
				success: 0x57d7b2,
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
				const target = (
					props as {
						readonly target?: {
							readonly kind?: string;
							readonly occupant?: unknown;
						};
					}
				).target;
				return {
					kind: target?.kind === "slot" && target.occupant !== null ? "swap" : "move",
				};
			}),
	};
});

vi.mock("~/ui/pixi/actor/createPixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createPixiTileActorFx: ({
			item,
			particleTextures,
		}: {
			readonly item: TileActorItem;
			readonly particleTextures: {
				readonly star: unknown;
			};
		}) =>
			EffectModule.sync(() => {
				const createContainer = sceneState.createContainer;
				if (createContainer === undefined) throw new Error("Pixi mock is not ready.");
				const actor = {
					activityParticles: {
						centerX: 40,
						container: {
							visible: false,
						},
						feedbackPhase: null,
						lastProgress: 0,
						lightSurface: false,
						particles: [
							{
								alphaScale: 1,
								particle: {
									alpha: 0,
									texture: particleTextures.star,
									tint: 0,
									x: 0,
									y: 0,
								},
								phaseOffset: 0,
								spreadOffset: 0,
								speedCycles: 1,
								waveOffset: 0,
							},
						],
						startY: 68,
						topHalfWidth: 24,
						topY: -18,
						workingTint: 0x00ff00,
					},
					container: createContainer(),
					lifecycleLayer: createContainer(),
					crowdLayer: {
						alpha: item.running ? 0.82 : 1,
					},
					currentVisual: {
						item,
					},
					instanceId: `test-inventory:${item.id}`,
					item,
					lifecycleDurationMs: 0,
					lifecycleTransitionStarted: false,
					lifecycleIntentGeneration: 0,
					lifecycleNotBeforeMs: 0,
					lifecycleTargetAlpha: 1,
					size: 0,
					visuals: new Set(),
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
				actor.currentVisual.item = item;
				actor.size = size;
			}),
	};
});

const inventoryItem = {
	compositeUrl: undefined,
	id: "runtime:water",
	itemId: "water",
	itemType: "simple",
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
	activityEffect: false,
	sourceUrl: "resource:water",
	title: "Water",
} satisfies TileActorItem;

const inventoryTargetItem = {
	...inventoryItem,
	id: "runtime:stone",
	itemId: "stone",
	location: {
		scope: "inventory",
		position: {
			x: 1,
			y: 0,
		},
	},
	revision: "revision:stone",
	sourceUrl: "resource:stone",
	title: "Stone",
} satisfies TileActorItem;

const pointer = (x: number, y: number, button = 0): FakePointerEvent => ({
	button,
	global: {
		x,
		y,
	},
	isPrimary: true,
	pointerId: 1,
	shiftKey: false,
	stopPropagation: vi.fn(),
});

const readTestInventoryLayout = (width = 800, height = 480) => {
	const preferredCellSize = Effect.runSync(
		readPixiMainSceneLayoutFx({
			boardHeight: 7,
			boardWidth: 11,
			height,
			toolbarSize: 8,
			width,
		}),
	).board.cellSize;
	return Effect.runSync(
		readPixiInventorySceneLayoutFx({
			columns: 5,
			height,
			preferredCellSize,
			rows: 4,
			width,
		}),
	);
};

const slotPointer = (x: number, button = 0) => {
	const { surface } = readTestInventoryLayout();
	return pointer(
		surface.x + (x + 0.5) * surface.cellSize,
		surface.y + surface.cellSize * 0.5,
		button,
	);
};

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
		reportCriticalFailure: vi.fn(),
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
	const host = document.createElement("div");
	document.body.append(host);
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
		game,
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
	sceneState.deferredTweenDurations.clear();
	sceneState.drop.mockClear();
	sceneState.particleTextureClose.mockClear();
	sceneState.items = [
		inventoryItem,
	];
	sceneState.owner = null;
	sceneState.preview.mockClear();
	sceneState.pendingTweenCompletions.length = 0;
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
	it("owns and drains the same running particle effect as the Board scene", async () => {
		sceneState.items = [
			{
				...inventoryItem,
				running: true,
				activityEffect: true,
			},
		];
		const { actor, runtime } = await mountScene();

		expect(actor.activityParticles.container).toMatchObject({
			visible: true,
		});
		expect(actor.activityParticles.particles[0]?.particle.texture).toBe(
			sceneState.particleTextures.star,
		);

		publishItems([
			{
				...inventoryItem,
				running: false,
				activityEffect: false,
			},
		]);
		expect(actor.activityParticles.container).toMatchObject({
			visible: false,
		});

		await Effect.runPromise(runtime.closeFx);
		expect(sceneState.particleTextureClose).toHaveBeenCalledOnce();
	});

	it("dips a surviving Inventory source from a committed input-consumption fact", async () => {
		sceneState.deferredTweenDurations.add(pixiTileActorConsumedSourceFadeDurationMs);
		const { actor, runtime } = await mountScene();
		const current = sceneState.transition;
		if (current === null) throw new Error("Test transition is missing.");
		const transition = {
			events: [
				{
					type: "item:input-stored",
					sourceItemId: inventoryItem.id,
					canonicalItemId: inventoryItem.itemId,
					previousSourceLocation: inventoryItem.location,
					previousQuantity: 4,
					storedQuantity: 1,
					resultingQuantity: 3,
					ownerItemId: "runtime:producer",
					lineId: "line:default",
					inputIndex: 0,
				},
			],
			previousRuntime: current.runtime,
			runtime: {
				currentSpace: 0,
			} as never,
			sequence: current.sequence + 1,
		} satisfies GameTransition;
		sceneState.items = [
			{
				...inventoryItem,
				quantity: 3,
				revision: "revision:water:3",
			},
		];
		sceneState.transition = transition;
		sceneState.transitionListener?.(transition);

		expect(actor.item.quantity).toBe(3);
		expect(actor.container.alpha).toBeCloseTo(0.42);
		await Effect.runPromise(runtime.closeFx);
	});

	it("hydrates historical Inventory feedback without replaying its animation", async () => {
		sceneState.deferredTweenDurations.add(pixiTileActorConsumedSourceFadeDurationMs);
		sceneState.items = [
			{
				...inventoryItem,
				quantity: 3,
				revision: "revision:water:historical",
			},
		];
		sceneState.transition = {
			events: [
				{
					type: "item:input-stored",
					sourceItemId: inventoryItem.id,
					canonicalItemId: inventoryItem.itemId,
					previousSourceLocation: inventoryItem.location,
					previousQuantity: 4,
					storedQuantity: 1,
					resultingQuantity: 3,
					ownerItemId: "runtime:producer",
					lineId: "line:default",
					inputIndex: 0,
				},
			],
			previousRuntime: null,
			runtime: {
				currentSpace: 0,
			} as never,
			sequence: 8,
		};
		const baseGame = createGame();
		const replayingGame = {
			...baseGame,
			subscribeTransitions: (listener: (transition: GameTransition) => void) => {
				sceneState.transitionListener = listener;
				if (sceneState.transition !== null) listener(sceneState.transition);
				return () => {
					if (sceneState.transitionListener === listener) {
						sceneState.transitionListener = null;
					}
				};
			},
		} as unknown as GameEngine;

		const { actor, runtime } = await mountScene({
			game: replayingGame,
		});

		expect(actor.item.quantity).toBe(3);
		expect(actor.container.alpha).toBe(1);
		expect(sceneState.pendingTweenCompletions).toEqual([]);
		await Effect.runPromise(runtime.closeFx);
	});

	it("uses the Board actor size and routes an ordinary click to Inventory activation", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const expectedBoardSize = Effect.runSync(
			readPixiMainSceneLayoutFx({
				boardHeight: 7,
				boardWidth: 11,
				height: 480,
				toolbarSize: 8,
				width: 800,
			}),
		).board.cellSize;

		expect(actor.size).toBe(expectedBoardSize);
		expect(sceneState.roundRects).toBeGreaterThanOrEqual(3);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(onActivate).toHaveBeenCalledWith(
			inventoryItem,
			false,
			expect.any(HTMLCanvasElement),
		);
		expect(sceneState.drop).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("starts removal feedback on click and retains the removed actor until its fade completes", async () => {
		sceneState.deferredTweenDurations.add(pixiTileActorLifecycleDurationMs);
		const onActivate = vi.fn(() => new Promise<void>(() => undefined));
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(actor.container.cursor).toBe("grab");
		expect(actor.container.alpha).toBe(0);
		expect(actor.container.destroyed).toBe(false);

		publishItems([]);

		expect(actor.onPointerDown).toBeNull();
		expect(actorContainer.eventMode).toBe("none");
		expect(actor.container.destroyed).toBe(false);

		for (const complete of [
			...sceneState.pendingTweenCompletions,
		]) {
			complete();
		}
		expect(actor.container.destroyed).toBe(true);
		await Effect.runPromise(runtime.closeFx);
	});

	it("reclaims the same physical actor when its item returns before exit completes", async () => {
		sceneState.deferredTweenDurations.add(pixiTileActorLifecycleDurationMs);
		const { actor, onActivate, runtime, stage } = await mountScene();

		publishItems([]);
		expect(actor.container.alpha).toBe(0);
		expect(actor.container.destroyed).toBe(false);

		publishItems([
			{
				...inventoryItem,
				quantity: 2,
				revision: "revision:water:return",
			},
		]);

		expect(sceneState.actors).toEqual([
			actor,
		]);
		expect(actor.item.quantity).toBe(2);
		expect(actor.container.alpha).toBe(1);
		expect(actor.container.destroyed).toBe(false);
		expect(actor.container.eventMode).toBe("static");
		expect(actor.container.cursor).toBe("grab");
		expect(actor.onPointerDown).not.toBeNull();

		for (const complete of [
			...sceneState.pendingTweenCompletions,
		]) {
			complete();
		}
		expect(actor.container.destroyed).toBe(false);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		expect(onActivate).toHaveBeenCalledOnce();
		await Effect.runPromise(runtime.closeFx);
	});

	it("coalesces repeated clicks while the same Inventory activation is still pending", async () => {
		const onActivate = vi.fn(() => new Promise<void>(() => undefined));
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(actor.container.alpha).toBe(0);
		await Effect.runPromise(runtime.closeFx);
	});

	it("restores a left-click fade after a newer right-click detail activation settles first", async () => {
		let resolveOrdinary: () => void = () => undefined;
		const ordinary = new Promise<void>((resolve) => {
			resolveOrdinary = resolve;
		});
		const onActivate = vi.fn((_item: TileActorItem, openDetail: boolean) =>
			openDetail ? Promise.resolve() : ordinary,
		);
		const { actor, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0, 2));
		stage.emit("pointerup", slotPointer(0, 2));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledTimes(2);
		expect(actor.container.alpha).toBe(0);

		resolveOrdinary();
		await flushMicrotasks();
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});

	it("drags only between Inventory slots and commits the release through the engine bridge", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		expect(sceneState.drop).toHaveBeenCalledOnce();
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
		expect(actor.container.x).toBe(initialX);
		await Effect.runPromise(runtime.closeFx);
	});

	it("rebases Inventory preview and release to the latest actor revision", async () => {
		const { actor, runtime, stage } = await mountScene();
		const latest = {
			...inventoryItem,
			quantity: 3,
			revision: "revision:water:latest",
		};

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([
			latest,
		]);

		expect(sceneState.preview).toHaveBeenLastCalledWith(
			expect.objectContaining({
				sourceItemId: latest.id,
				sourceLocation: latest.location,
				sourceRevision: latest.revision,
			}),
		);

		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: latest.id,
				sourceLocation: latest.location,
				sourceRevision: latest.revision,
			}),
		);
		await Effect.runPromise(runtime.closeFx);
	});

	it("cancels an Inventory release when the held actor moves", async () => {
		const { actor, runtime, stage } = await mountScene();

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([
			moveInventoryItem(1),
		]);
		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).not.toHaveBeenCalled();
		expect(actor.dragging).toBe(false);
		await Effect.runPromise(runtime.closeFx);
	});

	it("cancels an Inventory release when the held actor disappears", async () => {
		const { actor, runtime, stage } = await mountScene();

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		publishItems([]);
		stage.emit("pointerup", slotPointer(1));

		expect(sceneState.drop).not.toHaveBeenCalled();
		expect(actor.dragging).toBe(false);
		await Effect.runPromise(runtime.closeFx);
	});

	it("submits the exact occupied Inventory slot so the engine can commit a swap", async () => {
		sceneState.items = [
			inventoryItem,
			inventoryTargetItem,
		];
		const onDrop = vi.fn(() =>
			Promise.resolve({
				kind: "swap",
			} as never),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		const occupiedTarget = {
			kind: "slot",
			location: inventoryTargetItem.location,
			occupant: {
				itemId: inventoryTargetItem.id,
				revision: inventoryTargetItem.revision,
			},
		};
		expect(sceneState.preview).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: occupiedTarget,
			}),
		);
		expect(onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: inventoryItem.id,
				target: occupiedTarget,
			}),
		);
		await Effect.runPromise(runtime.closeFx);
	});

	it("flashes the canonical receiver after an accepted Inventory stack", async () => {
		sceneState.items = [
			inventoryItem,
			inventoryTargetItem,
		];
		sceneState.deferredTweenDurations.add(pixiTileActorConsumedSourceFadeDurationMs);
		sceneState.deferredTweenDurations.add(pixiTileActorFeedbackParticlesDurationMs);
		const onDrop = vi.fn(() =>
			Promise.resolve({
				kind: "stack",
				source: {
					current: {
						itemId: inventoryItem.id,
					},
					itemId: inventoryItem.id,
				},
				target: {
					itemId: inventoryTargetItem.id,
				},
			} as never),
		);
		const { actor, runtime, stage } = await mountScene({
			onDrop,
		});

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		const receiver = sceneState.actors[1];
		if (receiver === undefined) throw new Error("Expected the Inventory stack receiver.");
		expect(receiver.activityParticles.container).toMatchObject({
			visible: true,
		});
		expect(receiver.activityParticles.particles[0]?.particle.alpha).toBeGreaterThan(0);
		expect(actor.container.alpha).toBeCloseTo(0.42);
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
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.cursor).toBe("grab");
		expect(actor.container.x).not.toBe(initialX);
		Effect.runSync(runtime.cancelInteractionFx);
		expect(actor.container.x).not.toBe(initialX);
		actorContainer.emit("pointerdown", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
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
		const releasedPointer = slotPointer(1);
		const offsetReleasedPointer = pointer(
			releasedPointer.global.x + 10,
			releasedPointer.global.y,
		);
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", offsetReleasedPointer);
		stage.emit("pointerup", offsetReleasedPointer);
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		const releasedX = actor.container.x;
		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.dragging).toBe(true);
		expect(actor.container.x).toBe(releasedX);
		expect(actor.container.x).not.toBe(initialX + readTestInventoryLayout().surface.cellSize);

		if (resolveDrop === undefined) throw new Error("Drop Promise was not created.");
		resolveDrop({
			kind: "move",
		} as never);
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize);
		await Effect.runPromise(runtime.closeFx);
	});

	it("settles against the current snapshot when acceptance precedes its transition", async () => {
		const { actor, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await flushMicrotasks();

		expect(actor.dragging).toBe(false);
		expect(actor.container.zIndex).toBe(0);
		expect(actor.container.x).toBe(initialX);

		publishItems([
			moveInventoryItem(1),
		]);

		expect(actor.container.x).toBe(initialX + readTestInventoryLayout().surface.cellSize);
		await Effect.runPromise(runtime.closeFx);
	});

	it("cancels one active gesture through the shared interaction owner", async () => {
		const { actor, onActivate, onDrop, runtime, stage } = await mountScene();
		const initialX = actor.container.x;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		expect(actor.container.x).not.toBe(initialX);

		Effect.runSync(runtime.cancelInteractionFx);

		expect(actor.container.x).toBe(initialX);
		expect(runtime.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
		stage.emit("pointerup", slotPointer(1));
		expect(onDrop).not.toHaveBeenCalled();
		expect(onActivate).not.toHaveBeenCalled();
		await Effect.runPromise(runtime.closeFx);
	});

	it("settles a dragged actor at the latest physical size after a live resize", async () => {
		const { actor, runtime, stage } = await mountScene();
		const originalBaseSize = actor.size;
		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));

		if (sceneState.owner === null || sceneState.resize === null) {
			throw new Error("Inventory resize owner is missing.");
		}
		(
			sceneState.owner.app.screen as {
				width: number;
			}
		).width = 600;
		sceneState.resize();
		expect(actor.dragging).toBe(true);
		expect(actor.size).toBe(originalBaseSize);

		Effect.runSync(runtime.cancelInteractionFx);

		expect(actor.dragging).toBe(false);
		expect(actor.size * actor.container.scale.x).toBe(readTestInventoryLayout(600).actorSize);
		await Effect.runPromise(runtime.closeFx);
	});

	it("suppresses deferred activation but admits a released drop before close", async () => {
		const { actor, onActivate, runtime, stage } = await mountScene();
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		Effect.runSync(runtime.closeFx);
		await flushMicrotasks();
		expect(onActivate).not.toHaveBeenCalled();

		const second = await mountScene();
		const latestActor = sceneState.actors.at(-1);
		if (latestActor === undefined) throw new Error("Second Inventory actor is missing.");
		const secondActorContainer = latestActor.container as unknown as FakeContainer;
		secondActorContainer.emit("pointerdown", slotPointer(0));
		second.stage.emit("globalpointermove", slotPointer(1));
		second.stage.emit("pointerup", slotPointer(1));
		Effect.runSync(second.runtime.closeFx);
		await flushMicrotasks();
		expect(second.onDrop).toHaveBeenCalledOnce();
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
		const onActivate = vi.fn(() => {
			throw new Error("activation failed");
		});
		const { actor, game, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledTimes(2);
		expect(game.reportCriticalFailure).toHaveBeenCalledWith(
			"game-presentation",
			expect.any(Error),
		);
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});

	it("keeps expected Inventory activation rejections non-fatal", async () => {
		const expected = {
			_tag: "PlacementUnavailableError",
		};
		const onActivate = vi.fn(() => Promise.reject(expected));
		const { actor, game, runtime, stage } = await mountScene({
			onActivate,
		});
		const actorContainer = actor.container as unknown as FakeContainer;

		actorContainer.emit("pointerdown", slotPointer(0));
		stage.emit("pointerup", slotPointer(0));
		await flushMicrotasks();

		expect(onActivate).toHaveBeenCalledOnce();
		expect(game.reportCriticalFailure).not.toHaveBeenCalled();
		expect(actor.container.alpha).toBe(1);
		await Effect.runPromise(runtime.closeFx);
	});

	it("isolates synchronous drop failures and settles the released actor", async () => {
		const onDrop = vi.fn(() => {
			throw new Error("drop failed");
		});
		const { actor, game, runtime, stage } = await mountScene({
			onDrop,
		});
		const initialX = actor.container.x;

		(actor.container as unknown as FakeContainer).emit("pointerdown", slotPointer(0));
		stage.emit("globalpointermove", slotPointer(1));
		stage.emit("pointerup", slotPointer(1));
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(onDrop).toHaveBeenCalledOnce();
		expect(actor.container.x).toBe(initialX);
		expect(game.reportCriticalFailure).toHaveBeenCalledWith(
			"game-presentation",
			expect.any(Error),
		);
		await Effect.runPromise(runtime.closeFx);
	});
});
