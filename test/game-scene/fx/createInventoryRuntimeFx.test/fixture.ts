import type { GameEngine } from "~/playable-game/type/GameEngine";

import { afterEach, beforeEach, vi } from "vitest";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";

import { feedbackDurationMs } from "~/tile-rendering/fx/runActivityParticlesFx";

import { Effect } from "effect";

import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";

import { readInventoryLayoutFn } from "~/game-scene/fn/readInventoryLayoutFn";

import { createInventoryRuntimeFx } from "~/game-scene/fx/createInventoryRuntimeFx";

type CreateInventoryRuntimeProps = Parameters<typeof createInventoryRuntimeFx>[0];

export interface FakePointerEvent {
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

export interface FakeContainer {
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

export type GameTransition = ReturnType<GameEngine["getTransitionSnapshotFn"]>;

const sceneState = vi.hoisted(() => ({
	actors: [] as PixiTileActor[],
	afterRenderWork: [] as Array<() => void>,
	close: vi.fn(),
	createContainer: undefined as (() => FakeContainer) | undefined,
	deferFiniteTweens: false,
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

export const inventorySceneProbe = sceneState;

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

vi.mock("~/tile-rendering/fx/createApplicationOwnerFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createApplicationOwnerFx: ({ host }: { readonly host: HTMLElement }) =>
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
						scheduleAfterRenderFx: (work: () => void) =>
							EffectModule.sync(() => {
								sceneState.afterRenderWork.push(work);
								return () => {
									const index = sceneState.afterRenderWork.indexOf(work);
									if (index >= 0) sceneState.afterRenderWork.splice(index, 1);
								};
							}),
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

vi.mock("~/tile-rendering/fx/createParticleTexturesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createParticleTexturesFx: () =>
			EffectModule.succeed({
				closeFx: EffectModule.sync(sceneState.particleTextureClose),
				...sceneState.particleTextures,
			}),
	};
});

vi.mock("~/tile-rendering/fx/createAnimationDriverFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createAnimationDriverFx: () =>
			EffectModule.succeed({
				closeFx: EffectModule.void,
				createSpringFx: ({
					initialValue,
					onUpdateFn,
				}: {
					readonly initialValue: number;
					readonly onUpdateFn: (value: number) => void;
				}) =>
					EffectModule.sync(() => {
						onUpdateFn(initialValue);
						return {
							closeFx: EffectModule.void,
							setTargetFx: (value: number) =>
								EffectModule.sync(() => onUpdateFn(value)),
						};
					}),
				startTweenFx: ({
					durationMs,
					onCompleteFn,
					onUpdateFn,
					to,
				}: {
					readonly durationMs: number;
					readonly onCompleteFn?: () => void;
					readonly onUpdateFn: (value: number) => void;
					readonly to: number;
				}) =>
					EffectModule.sync(() => {
						const deferred = durationMs === 1_760 || sceneState.deferFiniteTweens;
						onUpdateFn(
							durationMs === 1_760 || durationMs === feedbackDurationMs ? 0.5 : to,
						);
						let active = true;
						const complete = () => {
							if (!active) return;
							active = false;
							onCompleteFn?.();
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

vi.mock("~/tile-rendering/fx/readScenePaletteFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readScenePaletteFx: () =>
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

vi.mock("~/tile-presentation/fx/readTileActorsFx", () => ({
	readTileActorsFx: () => ({
		type: "tile-actors",
	}),
}));

vi.mock("~/tile-interaction/fx/readTileDropPreviewFx", async () => {
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

vi.mock("~/tile-rendering/fx/createTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		createTileActorFx: ({
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

vi.mock("~/tile-rendering/fx/updateTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		updateTileActorFx: ({
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

export const inventoryItem = {
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

export const inventoryTargetItem = {
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

export const pointer = (x: number, y: number, button = 0): FakePointerEvent => ({
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

export const readTestInventoryLayout = (width = 800, height = 480) => {
	const preferredCellSize = readMainLayoutFn({
		boardHeight: 7,
		boardWidth: 11,
		height,
		toolbarSize: 8,
		width,
	}).board.cellSize;
	return readInventoryLayoutFn({
		columns: 5,
		height,
		preferredCellSize,
		rows: 4,
		width,
	});
};

export const slotPointer = (x: number, button = 0) => {
	const { surface } = readTestInventoryLayout();
	return pointer(
		surface.x + (x + 0.5) * surface.cellSize,
		surface.y + surface.cellSize * 0.5,
		button,
	);
};

export const flushMicrotasks = async () => {
	for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

export const flushAfterRender = () => {
	for (const work of sceneState.afterRenderWork.splice(0)) work();
};

export const createGame = ({ subscribeError }: { readonly subscribeError?: Error } = {}) => {
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
		getTransitionSnapshotFn: () => {
			const transition = sceneState.transition;
			if (transition === null) throw new Error("Test transition is missing.");
			return transition;
		},
		readOrThrowFn: () => sceneState.items,
		reportCriticalFailureFn: vi.fn(),
		subscribeTransitionsFn: (listenerFn: (transition: GameTransition) => void) => {
			if (subscribeError !== undefined) throw subscribeError;
			sceneState.transitionListener = listenerFn;
			return () => {
				if (sceneState.transitionListener === listenerFn) {
					sceneState.transitionListener = null;
				}
			};
		},
	} as unknown as GameEngine;
};

export const mountScene = async ({
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
	readonly onActivate?: CreateInventoryRuntimeProps["onActivateFn"];
	readonly onDrop?: CreateInventoryRuntimeProps["onDropFn"];
} = {}) => {
	const host = document.createElement("div");
	document.body.append(host);
	const runtime = await Effect.runPromise(
		createInventoryRuntimeFx({
			dragThreshold: 6,
			game,
			host,
			onActivateFn: onActivate,
			onDropFn: onDrop,
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

export const moveInventoryItem = (x: number): TileActorItem => ({
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

export const publishItems = (items: readonly TileActorItem[], notify = true) => {
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
	sceneState.afterRenderWork.length = 0;
	sceneState.close.mockClear();
	sceneState.deferFiniteTweens = false;
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
