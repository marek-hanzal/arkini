import { beforeEach, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";

import { Container, Graphics, Particle, ParticleContainer, Texture } from "pixi.js";

import { Effect } from "effect";

import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";

import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";

import type {
	PixiActorAnimation,
	PixiActorAnimationChannel,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";

import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";

import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";

import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";

import type { GameEngine } from "~/bridge/game/GameEngine";

import { createPixiMainSceneReconcilerFx } from "~/ui/pixi/scene/createPixiMainSceneReconcilerFx";

import { replacementCrossfadeDurationMs as productionReplacementCrossfadeDurationMs } from "~/ui/pixi/scene/runPixiMainSceneReplacementsFx";

import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";

import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";

const projectionState = vi.hoisted(() => ({
	cues: [] as unknown[],
	feedback: [] as unknown[],
	inventory: [] as unknown[],
	main: [] as unknown[],
	replacements: [] as unknown[],
}));

export const __fixture_projectionState = projectionState;

vi.mock("~/bridge/tile/feedback/readTileActorFeedbackCuesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readTileActorFeedbackCuesFx: () => EffectModule.succeed(projectionState.feedback),
	};
});

const createdVisualState = vi.hoisted(() => ({
	created: [] as unknown[],
}));

export const __fixture_createdVisualState = createdVisualState;

export const replacementCrossfadeDurationMs = productionReplacementCrossfadeDurationMs;

vi.mock("~/bridge/tile/readTileActorsFx", () => ({
	readTileActorsFx: ({ surface }: { readonly surface: "inventory" | "main" }) => ({
		kind: "tile-actors",
		surface,
	}),
}));

vi.mock("~/bridge/tile/readTileDeliveriesFx", () => ({
	readTileDeliveriesFx: () => ({
		kind: "tile-deliveries",
	}),
}));

vi.mock("~/bridge/tile/motion/readCommittedTileReplacementsFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readCommittedTileReplacementsFx: () => EffectModule.succeed(projectionState.replacements),
	};
});

vi.mock("~/bridge/tile/motion/readTileMotionCuesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readTileMotionCuesFx: () => EffectModule.succeed(projectionState.cues),
	};
});

vi.mock("~/ui/pixi/actor/createPixiTileActorVisualFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	const { Container: PixiContainer } = await import("pixi.js");
	return {
		createPixiTileActorVisualFx: ({
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
					size,
					textureGeneration: 1,
					textureState: "loading",
				};
				createdVisualState.created.push(visual);
				return visual;
			}),
	};
});

vi.mock("~/ui/pixi/text/fitPixiSingleLineTextFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		fitPixiSingleLineTextFx: ({ text }: { readonly text: string }) =>
			EffectModule.succeed(text),
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

export const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const inventoryLocation = {
	scope: "inventory" as const,
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
	itemId: "water",
	itemType: "simple",
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 3,
	revision: `revision:${id}`,
	running: false,
	activityEffect: false,
	sourceUrl: "resource:water",
	title: "Water",
	...overrides,
});

export const createVisual = (
	item: TileActorItem,
	textureState: PixiTileActorVisual["textureState"] = "ready",
) =>
	({
		container: new Container({
			eventMode: "none",
			label: `CurrentVisual:${item.revision}`,
		}),
		item,
		readyListeners: new Set(),
		size: 80,
		textureGeneration: 1,
		textureState,
	}) as unknown as PixiTileActorVisual;

export const createActor = (item: TileActorItem): PixiTileActor => {
	const container = new Container({
		eventMode: "static",
	});
	container.alpha = 1;
	container.position.set(40, 60);
	const lifecycleLayer = new Container();
	const offsetLayer = new Container();
	const crowdLayer = new Container();
	const visualLayer = new Container();
	const particle = new Particle(Texture.EMPTY);
	const activityParticleContainer = new ParticleContainer({
		particles: [
			particle,
		],
		texture: Texture.EMPTY,
	});
	activityParticleContainer.visible = false;
	const progressBar = new Graphics();
	const currentVisual = createVisual(item);
	visualLayer.addChild(currentVisual.container);
	crowdLayer.addChild(visualLayer);
	offsetLayer.addChild(activityParticleContainer, crowdLayer);
	lifecycleLayer.addChild(offsetLayer);
	container.addChild(lifecycleLayer);
	return {
		instanceId: `test:${item.id}`,
		container,
		lifecycleLayer,
		offsetLayer,
		crowdLayer,
		visualLayer,
		activityParticles: {
			centerX: 40,
			container: activityParticleContainer,
			feedbackPhase: null,
			lastProgress: 0,
			lightSurface: false,
			particles: [
				{
					alphaScale: 1,
					particle,
					phaseOffset: 0,
					spreadOffset: 0,
					speedCycles: 1,
					waveOffset: 0,
				},
			],
			startY: 68,
			topHalfWidth: 24,
			topY: -18,
			workingTint: 0xf05bb8,
		},
		progressBar,
		visuals: new Set([
			currentVisual,
		]),
		currentVisual,
		pendingVisual: null,
		item,
		size: 80,
		visualTransitionGeneration: 0,
		lifecycleIntentGeneration: 0,
		lifecycleTransitionStarted: false,
		lifecycleTargetAlpha: 1,
		lifecycleNotBeforeMs: 0,
		lifecycleDurationMs: 0,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		onPointerDown: null,
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
			canonicalItems,
			closeFx: Effect.void,
			deleteActorFx: (actorId: string) =>
				Effect.sync(() => {
					const deleted = actors.get(actorId) ?? null;
					actors.delete(actorId);
					return deleted;
				}),
			destroyExitingActorFx: (exitingActor: PixiTileActor) =>
				Effect.gen(function* () {
					exitingActors.delete(exitingActor);
					yield* destroyPixiTileActorFx(exitingActor);
				}),
			readActorFx: (actorId: string) => Effect.succeed(actors.get(actorId) ?? null),
			readCanonicalItemFx: (actorId: string) =>
				Effect.succeed(canonicalItems.get(actorId) ?? null),
			readCanonicalOccupantFx: (location: TileActorItem["location"]) =>
				Effect.succeed(
					Array.from(canonicalItems.values()).find(
						(item) => JSON.stringify(item.location) === JSON.stringify(location),
					) ?? null,
				),
			readCanonicalOccupantsFx: (locations: ReadonlyArray<TileActorItem["location"]>) =>
				Effect.succeed(
					locations.flatMap((location) => {
						const item = Array.from(canonicalItems.values()).find(
							(candidate) =>
								JSON.stringify(candidate.location) === JSON.stringify(location),
						);
						return item === undefined
							? []
							: [
									item,
								];
					}),
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
		} satisfies PixiMainSceneActorStore,
	};
};

export const createAnimator = () => {
	const animations: PixiActorAnimation[] = [];
	const activeChannels = new WeakMap<PixiTileActor, Map<PixiActorAnimationChannel, symbol>>();
	const canceledActors: PixiTileActor[] = [];
	const canceledChannels: Array<{
		readonly actor: PixiTileActor;
		readonly channel: PixiActorAnimationChannel;
	}> = [];
	const canceledOwners: string[] = [];
	const writes: PixiActorPresentationWrite[] = [];
	const clearChannel = (
		actor: PixiTileActor,
		channel: PixiActorAnimationChannel,
		token?: symbol,
	) => {
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
						activeChannels.get(animation.actor) ??
						new Map<PixiActorAnimationChannel, symbol>();
					channels.set(animation.channel, token);
					activeChannels.set(animation.actor, channels);
					animations.push({
						...animation,
						onCancel: () => {
							clearChannel(animation.actor, animation.channel, token);
							animation.onCancel?.();
						},
						onComplete: () => {
							clearChannel(animation.actor, animation.channel, token);
							animation.onComplete?.();
						},
					} as PixiActorAnimation);
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
						case "activity-particles":
							write.actor.activityParticles.container.visible = write.visible;
							break;
					}
				}),
		} satisfies PixiActorAnimator,
	};
};

export const createDrag = () => {
	const detached: PixiTileActor[] = [];
	const requestRefresh = vi.fn();
	return {
		detached,
		requestRefresh,
		drag: {
			attachActorFx: () => Effect.void,
			cancelInteractionFx: Effect.void,
			closeFx: Effect.void,
			detachActorFx: (actor: PixiTileActor) =>
				Effect.sync(() => {
					detached.push(actor);
				}),
			requestRefreshFx: Effect.sync(requestRefresh),
			setInteractionBlockedFx: () => Effect.void,
		} satisfies PixiMainSceneDragController,
	};
};

export const createMotion = () =>
	({
		beginInteractionHandoffFx: () => Effect.succeed(false),
		closeFx: Effect.void,
		enqueueFx: () => Effect.void,
		redirectTargetFx: () => Effect.void,
		readSnapshotFx: Effect.succeed({
			interactionClaimByActorId: new Map(),
			retainedActorIds: new Set(),
			spawnCueByActorId: new Map(),
			quantityPresentationByActorId: new Map(),
		}),
		startFx: Effect.void,
		syncPresentationFx: Effect.void,
	}) satisfies PixiTileMotionRuntime;

export const createReconcilerHarness = ({
	actor,
	motion = createMotion(),
	pose = {
		size: 80,
		x: 40,
		y: 60,
	},
	readPose = true,
}: {
	readonly actor: PixiTileActor;
	readonly motion?: PixiTileMotionRuntime;
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
	} as unknown as PixiMainSceneSurface;
	const dropPresentation = Effect.runSync(createPixiMainSceneDropPresentationFx());
	const game = {
		readOrThrow: (query: unknown) => {
			const projection = query as {
				readonly kind: "tile-actors" | "tile-deliveries";
				readonly surface: "inventory" | "main";
			};
			if (projection.kind === "tile-deliveries") return [];
			if (projection.kind !== "tile-actors") throw new Error("Unexpected game read.");
			return projectionState[projection.surface];
		},
	} as unknown as GameEngine;
	const reconciler = Effect.runSync(
		createPixiMainSceneReconcilerFx({
			actorStore: store,
			animator: animatorHarness.animator,
			application: {
				frames: {
					invalidateFx: Effect.sync(invalidate),
				},
			} as unknown as PixiApplicationOwner,
			drag: dragHarness.drag,
			delivery: {
				closeFx: Effect.void,
				readSnapshotFx: Effect.succeed({
					retainedActorIds: new Set(),
				}),
				syncFx: () => Effect.void,
			},
			dropPresentation,
			game,
			magneticField: {
				closeFx: Effect.void,
				flushFx: Effect.void,
				pruneFx: Effect.void,
				readActiveSourceActorIdsFx: Effect.succeed([]),
				releaseFx: () => Effect.void,
				releaseSourcesFx: () => Effect.void,
				resetFx: Effect.void,
				subscribeSourceMembershipFx: () => Effect.succeed(() => {}),
				updateFx: () => Effect.void,
			} satisfies PixiTileMagneticField,
			motion,
			particleTextures: {
				closeFx: Effect.void,
				star: Texture.EMPTY,
			},
			readPalette: () =>
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

export const transition = (sequence: number) =>
	({
		events: [],
		previousRuntime: {},
		runtime: {},
		sequence,
	}) as unknown as ReturnType<GameEngine["getTransitionSnapshot"]>;

beforeEach(() => {
	projectionState.cues = [];
	projectionState.feedback = [];
	projectionState.main = [];
	projectionState.inventory = [];
	projectionState.replacements = [];
	createdVisualState.created = [];
});
