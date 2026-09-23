import { beforeEach, vi } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";

import { Container, Graphics } from "pixi.js";

import { Effect } from "effect";

import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";

import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";

import type {
	ActorAnimation,
	AnimationChannel,
	ActorAnimator,
	PresentationWrite,
} from "~/tile-rendering/service/ActorAnimator";

import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";

import type { MainSurface } from "~/game-scene/service/MainSurface";

import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameTransition } from "~/game-session/type/GameSession";

import { createMainReconcilerFx } from "~/game-scene/fx/createMainReconcilerFx";
import type { PresentationRuntime } from "~/game-scene/service/PresentationRuntime";

import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";

const projectionState = vi.hoisted(() => ({
	main: [] as unknown[],
}));

export const projectionProbeState = projectionState;

const createdVisualState = vi.hoisted(() => ({
	created: [] as unknown[],
}));

export const __fixture_createdVisualState = createdVisualState;

vi.mock("~/tile-presentation/fx/readTileActorsFx", () => ({
	readTileActorsFx: () => ({
		kind: "tile-actors",
	}),
}));

vi.mock("~/tile-rendering/fx/createActorVisualFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	const { Container: PixiContainer } = await import("pixi.js");
	return {
		createActorVisualFx: ({
			item,
			size,
		}: {
			readonly item: TileActorItem;
			readonly size: number;
		}) =>
			EffectModule.sync(() => {
				const visual = {
					container: new PixiContainer({
						eventMode: "none",
						label: `TestVisual:${item.revision}`,
					}),
					item,
					readyListeners: new Set(),
					releaseTexturesFn: () => {},
					size,
					textureGeneration: 1,
					textureState: "loading",
				};
				createdVisualState.created.push(visual);
				return visual;
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
				actor.size = size;
			}),
	};
});

export const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const createItem = (
	id: string,
	location: TileActorItem["location"],
	overrides: Partial<TileActorItem> = {},
): TileActorItem => ({
	compositeUrl: undefined,
	id,
	itemUid: "water",

	location,
	primaryAction: {
		kind: "none",
	},
	revision: `revision:${id}`,
	running: false,

	artworkScale: 0.8,
	sourceUrl: "resource:water",
	...overrides,
});

export const createVisual = (
	item: TileActorItem,
	textureState: ActorVisual["textureState"] = "ready",
) =>
	({
		container: new Container({
			eventMode: "none",
			label: `CurrentVisual:${item.revision}`,
		}),
		item,
		readyListeners: new Set(),
		releaseTexturesFn: () => {},
		size: 80,
		textureGeneration: 1,
		textureState,
	}) as unknown as ActorVisual;

export const createActor = (item: TileActorItem): PixiTileActor => {
	const container = new Container({
		eventMode: "static",
	});
	container.alpha = 1;
	container.position.set(40, 60);
	const lifecycleLayer = new Container();
	const crowdLayer = new Container();
	const visualLayer = new Container();
	const progressBar = new Graphics();
	const currentVisual = createVisual(item);
	visualLayer.addChild(currentVisual.container);
	crowdLayer.addChild(visualLayer);
	lifecycleLayer.addChild(crowdLayer);
	container.addChild(lifecycleLayer);
	return {
		instanceId: `test:${item.id}`,
		container,
		lifecycleLayer,
		crowdLayer,
		visualLayer,
		progressBar,
		clockRing: new Graphics(),
		visuals: new Set([
			currentVisual,
		]),
		currentVisual,
		pendingVisual: null,
		item,
		size: 80,
		visualTransitionGeneration: 0,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		onPointerDownFn: null,
	} satisfies PixiTileActor;
};

export const createActorStore = (actor: PixiTileActor) => {
	const actors = new Map([
		[
			actor.item.id,
			actor,
		],
	]);
	const canonicalItems = new Map([
		[
			actor.item.id,
			actor.item,
		],
	]);
	const exitingActors = new Set<PixiTileActor>();
	return {
		actors,
		canonicalItems,
		store: {
			actors,
			exitingActors,
			canonicalItems,
			closeFx: Effect.void,
			destroyExitingActorFx: (exitingActor: PixiTileActor) =>
				Effect.gen(function* () {
					exitingActors.delete(exitingActor);
					yield* destroyTileActorFx(exitingActor);
				}),
			readCanonicalOccupantFx: (location: TileActorItem["location"]) =>
				Effect.succeed(
					Array.from(canonicalItems.values()).find(
						(item) => JSON.stringify(item.location) === JSON.stringify(location),
					) ?? null,
				),
			replaceCanonicalItemsFx: (items: ReadonlyArray<TileActorItem>) =>
				Effect.sync(() => {
					canonicalItems.clear();
					for (const item of items) canonicalItems.set(item.id, item);
				}),
			releaseActorFx: (actorId: string) =>
				Effect.sync(() => {
					const released = actors.get(actorId) ?? null;
					actors.delete(actorId);
					if (released !== null) exitingActors.add(released);
					return released;
				}),
			setActorFx: (nextActor: PixiTileActor) =>
				Effect.sync(() => {
					actors.set(nextActor.item.id, nextActor);
				}),
		} satisfies MainActorStore,
	};
};

export const createAnimator = () => {
	const animations: ActorAnimation[] = [];
	const activeChannels = new WeakMap<PixiTileActor, Map<AnimationChannel, symbol>>();
	const canceledActors: PixiTileActor[] = [];
	const canceledChannels: Array<{
		readonly actor: PixiTileActor;
		readonly channel: AnimationChannel;
	}> = [];
	const canceledOwners: string[] = [];
	const writes: PresentationWrite[] = [];
	const clearChannel = (actor: PixiTileActor, channel: AnimationChannel, token?: symbol) => {
		const channels = activeChannels.get(actor);
		if (channels === undefined) return;
		if (token !== undefined && channels.get(channel) !== token) return;
		channels.delete(channel);
		if (channels.size === 0) activeChannels.delete(actor);
	};
	return {
		animations,
		canceledActors,
		canceledChannels,
		canceledOwners,
		writes,
		animator: {
			animateFx: (animation) =>
				Effect.sync(() => {
					const token = Symbol();
					const channels =
						activeChannels.get(animation.actor) ?? new Map<AnimationChannel, symbol>();
					channels.set(animation.channel, token);
					activeChannels.set(animation.actor, channels);
					animations.push({
						...animation,
						onCancelFn: () => {
							clearChannel(animation.actor, animation.channel, token);
							animation.onCancelFn?.();
						},
						onCompleteFn: () => {
							clearChannel(animation.actor, animation.channel, token);
							animation.onCompleteFn?.();
						},
					} as ActorAnimation);
				}),
			cancelActorFx: (actor) =>
				Effect.sync(() => {
					activeChannels.delete(actor);
					canceledActors.push(actor);
				}),
			cancelChannelFx: (actor, channel) =>
				Effect.sync(() => {
					clearChannel(actor, channel);
					canceledChannels.push({
						actor,
						channel,
					});
				}),
			cancelFx: (ownerKey) =>
				Effect.sync(() => {
					canceledOwners.push(ownerKey);
				}),
			closeFx: Effect.void,
			isChannelActiveFx: (actor, channel) =>
				Effect.sync(() => activeChannels.get(actor)?.has(channel) === true),
			setFx: (write) =>
				Effect.sync(() => {
					clearChannel(write.actor, write.channel);
					writes.push(write);
					switch (write.channel) {
						case "pose":
							write.actor.container.position.set(write.x, write.y);
							if (write.scale !== undefined)
								write.actor.container.scale.set(write.scale);
							break;
						case "lifecycle-opacity":
							write.actor.container.alpha = write.alpha;
							break;
						case "crowd-opacity":
							write.actor.crowdLayer.alpha = write.alpha;
							break;
					}
				}),
		} satisfies ActorAnimator,
	};
};

export const createDrag = () => {
	const detached: PixiTileActor[] = [];
	const requestRefresh = vi.fn();
	const settledOriginGhosts: PixiTileActor[] = [];
	return {
		detached,
		requestRefresh,
		settledOriginGhosts,
		drag: {
			attachActorFx: () => Effect.void,
			cancelInteractionFx: Effect.void,
			closeFx: Effect.void,
			detachActorFx: (actor: PixiTileActor) =>
				Effect.sync(() => {
					detached.push(actor);
				}),
			requestRefreshFx: Effect.sync(requestRefresh),
			refreshPointerFx: () => Effect.void,
			settleOriginGhostFx: (actor: PixiTileActor) =>
				Effect.sync(() => {
					settledOriginGhosts.push(actor);
				}),
			setInteractionBlockedFx: () => Effect.void,
		} satisfies MainDragController,
	};
};

const createPresentation = (animator: ActorAnimator) => {
	const appears: Parameters<PresentationRuntime["appearFx"]>[0][] = [];
	const disappears: Parameters<PresentationRuntime["disappearFx"]>[0][] = [];
	const crossfades: Parameters<PresentationRuntime["crossfadeFx"]>[0][] = [];
	const travels: Parameters<PresentationRuntime["travelFx"]>[0][] = [];
	const traveling = new Set<PixiTileActor>();
	return {
		appears,
		disappears,
		crossfades,
		travels,
		presentation: {
			appearFx: (props) =>
				Effect.sync(() => {
					appears.push(props);
				}),
			disappearFx: (props) =>
				Effect.sync(() => {
					disappears.push(props);
				}),
			crossfadeFx: (props) =>
				Effect.sync(() => {
					crossfades.push(props);
				}),
			travelFx: (props) =>
				Effect.gen(function* () {
					travels.push(props);
					traveling.add(props.actor);
					yield* animator.animateFx({
						actor: props.actor,
						channel: "pose",
						durationMs: 180,
						toX: props.target.x,
						toY: props.target.y,
					});
				}),
			isTravelingFx: (actor) => Effect.sync(() => traveling.has(actor)),
			exitBoardFx: () => Effect.void,
			enterBoardFx: () => Effect.void,
			cancelActorFx: (actor) =>
				Effect.sync(() => {
					traveling.delete(actor);
				}),
			cancelAllFx: Effect.void,
			closeFx: Effect.void,
		} satisfies PresentationRuntime,
	};
};

export const createReconcilerHarness = ({
	actor,
	pose = {
		size: 80,
		x: 40,
		y: 60,
	},
	readPose = true,
}: {
	readonly actor: PixiTileActor;
	readonly pose?: {
		readonly size: number;
		readonly x: number;
		readonly y: number;
	};
	readonly readPose?: boolean;
}) => {
	const { actors, canonicalItems, store } = createActorStore(actor);
	const animatorHarness = createAnimator();
	const dragHarness = createDrag();
	const presentationHarness = createPresentation(animatorHarness.animator);
	const invalidate = vi.fn();
	const layer = new Container();
	const transientActorLayer = new Container();
	const surface = {
		readActorPoseFx: () =>
			Effect.succeed(
				readPose
					? {
							layer,
							...pose,
						}
					: null,
			),
		transientActorLayer,
	} as unknown as MainSurface;
	const dropPresentation = Effect.runSync(createDropPresentationFx());
	const game = {
		readOrThrowFn: (query: unknown) => {
			const projection = query as {
				readonly kind: "tile-actors";
			};
			if (projection.kind !== "tile-actors") throw new Error("Unexpected game read.");
			return projectionState.main;
		},
	} as unknown as GameEngine;
	const reconciler = Effect.runSync(
		createMainReconcilerFx({
			actorStore: store,
			animator: animatorHarness.animator,
			application: {
				frames: {
					invalidateFx: Effect.sync(invalidate),
				},
			} as unknown as PixiApplicationOwner,
			drag: dragHarness.drag,
			game,
			presentation: presentationHarness.presentation,
			readPaletteFn: () =>
				({
					success: 0x57d7b2,
				}) as never,
			surface,
			textures: {} as never,
		}),
	);
	return {
		...animatorHarness,
		...dragHarness,
		...presentationHarness,
		actors,
		canonicalItems,
		dropPresentation,
		invalidate,
		layer,
		reconciler,
		store,
		surface,
		transientActorLayer,
	};
};

export const transition = (sequence: number, events: GameTransition["events"] = []) =>
	({
		events,
		previousRuntime: {},
		runtime: {},
		sequence,
	}) as unknown as ReturnType<GameEngine["getTransitionSnapshotFn"]>;

beforeEach(() => {
	projectionState.main = [];
	createdVisualState.created = [];
});
