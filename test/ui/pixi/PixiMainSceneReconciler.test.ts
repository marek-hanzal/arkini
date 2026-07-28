import { Effect } from "effect";
import { Container, Graphics, Particle, ParticleContainer, Texture } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { completePixiTileActorVisualTextureLoadFx } from "~/ui/pixi/actor/PixiTileActorVisualReadiness";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import type {
	PixiActorAnimation,
	PixiActorAnimationChannel,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { burstPixiTileActorAckParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import type { PixiMainSceneDragController } from "~/ui/pixi/drag/PixiMainSceneDragController";
import { settlePixiMainSceneDraggedActorFx } from "~/ui/pixi/drag/settlePixiMainSceneDraggedActorFx";
import { createPixiMainSceneDropPresentationFx } from "~/ui/pixi/drop/createPixiMainSceneDropPresentationFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import type { PixiTileMotionRuntime } from "~/ui/pixi/motion/PixiTileMotionRuntime";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import { createPixiMainSceneReconcilerFx } from "~/ui/pixi/scene/createPixiMainSceneReconcilerFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { replacementCrossfadeDurationMs } from "~/ui/pixi/scene/runPixiMainSceneReplacementsFx";

const projectionState = vi.hoisted(() => ({
	cues: [] as unknown[],
	feedback: [] as unknown[],
	inventory: [] as unknown[],
	main: [] as unknown[],
	replacements: [] as unknown[],
}));

vi.mock("~/bridge/tile/feedback/readTileActorFeedbackCuesFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	return {
		readTileActorFeedbackCuesFx: () => EffectModule.succeed(projectionState.feedback),
	};
});

const createdVisualState = vi.hoisted(() => ({
	created: [] as unknown[],
}));

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

const boardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const inventoryLocation = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};

const createItem = (
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

const createVisual = (
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

const createActor = (item: TileActorItem): PixiTileActor => {
	const container = new Container({
		eventMode: "static",
	});
	container.alpha = 1;
	container.position.set(40, 60);
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
	container.addChild(offsetLayer);
	return {
		instanceId: `test:${item.id}`,
		container,
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
		lifecycleFadeStarted: false,
		lifecycleTargetAlpha: 1,
		lifecycleNotBeforeMs: 0,
		lifecycleDurationMs: 0,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		onPointerDown: null,
	} satisfies PixiTileActor;
};

const createActorStore = (actor: PixiTileActor) => {
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

const createAnimator = () => {
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

const createDrag = () => {
	const detached: PixiTileActor[] = [];
	return {
		detached,
		drag: {
			attachActorFx: () => Effect.void,
			cancelInteractionFx: Effect.void,
			closeFx: Effect.void,
			detachActorFx: (actor: PixiTileActor) =>
				Effect.sync(() => {
					detached.push(actor);
				}),
			setInteractionBlockedFx: () => Effect.void,
		} satisfies PixiMainSceneDragController,
	};
};

const createMotion = () =>
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

const createReconcilerHarness = ({
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
				pruneFx: Effect.void,
				releaseFx: () => Effect.void,
				releaseSourcesFx: () => Effect.void,
				resetFx: Effect.void,
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

const transition = (sequence: number) =>
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

describe("Pixi main-scene reconciliation", () => {
	it("applies same-frame add, update, and removal from one classified snapshot", () => {
		const previous = createItem("runtime:update", boardLocation);
		const current = createItem(previous.id, boardLocation, {
			quantity: 4,
			revision: "revision:update:4",
		});
		const removed = createItem("runtime:removed", boardLocation);
		const added = createItem("runtime:added", boardLocation);
		const harness = createReconcilerHarness({
			actor: createActor(previous),
		});
		Effect.runSync(harness.store.setActorFx(createActor(removed)));
		projectionState.main = [
			current,
			added,
		];
		projectionState.inventory = [
			createItem(removed.id, inventoryLocation),
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect([
			...harness.actors.keys(),
		]).toEqual([
			current.id,
			added.id,
		]);
		expect(harness.actors.get(current.id)?.item.revision).toBe(current.revision);
		expect(harness.actors.get(added.id)?.item).toEqual(added);
	});

	it("does not allocate another actor for an identical repeated snapshot", () => {
		const previous = createItem("runtime:previous", boardLocation);
		const added = createItem("runtime:added", boardLocation);
		const harness = createReconcilerHarness({
			actor: createActor(previous),
		});
		projectionState.main = [
			added,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const createdVisualCount = createdVisualState.created.length;
		const addedInstanceId = harness.actors.get(added.id)?.instanceId;
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(createdVisualState.created).toHaveLength(createdVisualCount);
		expect(harness.actors.get(added.id)?.instanceId).toBe(addedInstanceId);
	});

	it("keeps a closed owner inert while a remounted owner reconciles the current snapshot", () => {
		const previous = createItem("runtime:remount", boardLocation);
		const current = createItem(previous.id, boardLocation, {
			quantity: 5,
			revision: "revision:remount:5",
		});
		const closedHarness = createReconcilerHarness({
			actor: createActor(previous),
		});
		projectionState.main = [
			current,
		];

		Effect.runSync(closedHarness.reconciler.closeFx);
		Effect.runSync(closedHarness.reconciler.reconcileFx(transition(2)));
		expect(closedHarness.actors.get(previous.id)?.item.revision).toBe(previous.revision);

		const remountedHarness = createReconcilerHarness({
			actor: createActor(previous),
		});
		Effect.runSync(remountedHarness.reconciler.hydrateFx(transition(2)));
		expect(remountedHarness.actors.get(current.id)?.item.revision).toBe(current.revision);
	});

	it("holds an input source at its pre-contact quantity and suppresses early feedback", () => {
		const previous = createItem("runtime:input-source", boardLocation, {
			badgeCount: 7,
			quantity: 7,
			revision: "revision:input-source:7",
		});
		const current = createItem(previous.id, boardLocation, {
			badgeCount: 2,
			quantity: 2,
			revision: "revision:input-source:2",
		});
		const actor = createActor(previous);
		const motion = {
			...createMotion(),
			readSnapshotFx: Effect.succeed({
				interactionClaimByActorId: new Map([
					[
						previous.id,
						"activation-only" as const,
					],
				]),
				retainedActorIds: new Set([
					previous.id,
					"runtime:owner",
				]),
				spawnCueByActorId: new Map(),
				quantityPresentationByActorId: new Map([
					[
						previous.id,
						{
							kind: "exact",
							quantity: 7,
						},
					],
				]),
			}),
		} satisfies PixiTileMotionRuntime;
		const harness = createReconcilerHarness({
			actor,
			motion,
		});
		projectionState.main = [
			current,
		];
		projectionState.cues = [
			{
				canonicalItemId: previous.itemId,
				eventIndex: 0,
				kind: "input",
				originActorId: previous.id,
				originLocation: boardLocation,
				previousQuantity: 7,
				storedQuantity: 5,
				resultingQuantity: 2,
				sequence: 2,
				sourceActorId: previous.id,
				staggerIndex: 0,
				targetActorId: "runtime:owner",
				targetLocation: boardLocation,
			},
		];
		projectionState.feedback = [
			{
				actorId: previous.id,
				key: "2:0:consume-source",
				kind: "consume-source",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(actor.item.quantity).toBe(7);
		expect(actor.currentVisual.item.badgeCount).toBe(7);
		expect(
			harness.animations.some(
				(animation) =>
					animation.actor === actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0.42,
			),
		).toBe(false);
	});

	it("keeps a resolved line owner alive until its last input presentation settles", () => {
		const owner = createItem("runtime:resolved-craft", boardLocation);
		const actor = createActor(owner);
		const retainedActorIds = new Set([
			owner.id,
		]);
		const motion = {
			...createMotion(),
			readSnapshotFx: Effect.sync(() => ({
				interactionClaimByActorId: new Map(),
				retainedActorIds,
				spawnCueByActorId: new Map(),
				quantityPresentationByActorId: new Map(),
			})),
		} satisfies PixiTileMotionRuntime;
		const harness = createReconcilerHarness({
			actor,
			motion,
		});
		projectionState.main = [];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.actors.get(owner.id)).toBe(actor);
		expect(harness.detached).toEqual([]);
		expect(harness.animations).toEqual([]);

		retainedActorIds.clear();
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.actors.has(owner.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 220,
				toAlpha: 0,
			}),
		);
	});

	it("keeps a canonical board transport above masks until it reaches its destination", () => {
		const previous = createItem("runtime:moving-water", boardLocation);
		const current = createItem(previous.id, {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		});
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(actor.container.parent).toBe(harness.transientActorLayer);
		const travel = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a canonical pose travel.");
		expect(actor.container.parent).not.toBe(harness.layer);

		travel.onComplete?.();
		expect(actor.container.parent).toBe(harness.layer);
	});

	it("springs a directly dropped actor into its committed slot", () => {
		const previous = createItem("runtime:dropped-water", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		};
		const current = createItem(previous.id, destination);
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		const generation = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: previous.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation,
				result: {
					itemId: current.id,
					kind: "move",
					location: destination,
					previousLocation: boardLocation,
					revision: current.revision,
				},
			}),
		);
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		const landing = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		expect(landing).toMatchObject({
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
		});
		expect(landing?.durationMs).toBeLessThan(280);
		expect(Effect.runSync(harness.dropPresentation.readSnapshotFx).landingActorIds).toEqual(
			new Set(),
		);
	});

	it("does not restart a direct landing when a running job ticks mid-flight", () => {
		const previous = createItem("runtime:dropped-water", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		};
		const current = createItem(previous.id, destination);
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		const generation = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: previous.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation,
				result: {
					itemId: current.id,
					kind: "move",
					location: destination,
					previousLocation: boardLocation,
					revision: current.revision,
				},
			}),
		);
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const landing = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		projectionState.main = [
			{
				...current,
				activityEffect: true,
				revision: `${current.revision}:tick`,
				running: true,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(
			harness.animations.filter(
				(animation) => animation.actor === actor && animation.channel === "pose",
			),
		).toEqual([
			landing,
		]);
	});

	it("does not restart a rejected-drop return when a running job ticks mid-flight", () => {
		const current = createItem("runtime:rejected-trash", boardLocation, {
			itemId: "trash",
			title: "Trash",
		});
		const actor = createActor(current);
		actor.container.position.set(500, 400);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			current,
		];
		Effect.runSync(
			settlePixiMainSceneDraggedActorFx({
				actor,
				animator: harness.animator,
				surface: harness.surface,
			}),
		);
		const returning = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		projectionState.main = [
			{
				...current,
				activityEffect: true,
				revision: `${current.revision}:tick`,
				running: true,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(
			harness.animations.filter(
				(animation) => animation.actor === actor && animation.channel === "pose",
			),
		).toEqual([
			returning,
		]);
	});

	it("retains a pending source, then fades it while bursting the Inventory receiver", () => {
		const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
		const source = createItem("runtime:water-source", boardLocation);
		const inventorySpawn = createItem("runtime:water-inventory-new-id", inventoryLocation);
		const inventory = createItem("runtime:backpack", boardLocation);
		const actor = createActor(source);
		const harness = createReconcilerHarness({
			actor,
		});
		const inventoryActor = createActor(inventory);
		harness.actors.set(inventory.id, inventoryActor);
		harness.canonicalItems.set(inventory.id, inventory);
		const dropGeneration = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: source.id,
				swapCandidate: null,
			}),
		);
		projectionState.inventory = [
			inventorySpawn,
		];
		projectionState.main = [
			inventory,
		];
		actor.container.alpha = 0.37;
		actor.lifecycleDurationMs = 260;
		actor.lifecycleFadeStarted = true;
		actor.lifecycleNotBeforeMs = 900;
		actor.lifecycleTargetAlpha = 0;

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.actors.get(source.id)).toBe(actor);
		expect(harness.detached).toEqual([]);
		expect(harness.animations).toEqual([]);
		expect(actor.container.alpha).toBe(0.37);

		const result = {
			kind: "store-inventory",
			source: {
				itemId: source.id,
				canonicalItemId: source.itemId,
				previousRevision: source.revision,
				previousLocation: source.location,
				previousQuantity: source.quantity,
				current: null,
			},
			inventory: {
				itemId: "runtime:backpack",
				revision: "revision:backpack",
				location: boardLocation,
			},
		} satisfies runTileDropAtom.Result;
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation: dropGeneration,
				result,
			}),
		);
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.actors.has(source.id)).toBe(false);
		expect(harness.detached).toEqual([
			actor,
		]);
		expect(harness.canceledActors).toEqual([
			actor,
		]);
		expect(actor.container.alpha).toBe(0.37);
		expect(actor.container.destroyed).toBe(false);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 160,
				toAlpha: 0,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor: inventoryActor,
				channel: "activity-particles",
				durationMs: 720,
			}),
		);
		expect(Effect.runSync(harness.dropPresentation.readSnapshotFx).feedback).toEqual([]);

		const exit = harness.animations.find(
			(animation) =>
				animation.actor === actor &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		const destroy = vi.spyOn(actor.container, "destroy");
		exit?.onComplete?.();
		exit?.onComplete?.();
		expect(destroy).toHaveBeenCalledOnce();
		expect(actor.container.destroyed).toBe(true);
		expect(actor.visuals.size).toBe(0);
		now.mockRestore();
	});

	it("bursts a surviving committed feedback receiver exactly once", () => {
		const item = createItem("runtime:tree", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			item,
		];
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "2:0:resource-spent",
				kind: "resource-spent",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${actor.instanceId}`,
			}),
		);
		const animationCount = harness.animations.length;

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toHaveLength(animationCount);
	});

	it("keeps a success ACK alive across an instant running-to-idle transition", () => {
		const idle = createItem("runtime:producer", boardLocation);
		const running = {
			...idle,
			revision: "revision:producer:running",
			running: true,
			activityEffect: true,
		} satisfies TileActorItem;
		const settled = {
			...idle,
			revision: "revision:producer:settled",
		} satisfies TileActorItem;
		const actor = createActor(idle);
		const harness = createReconcilerHarness({
			actor,
		});
		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
				actor,
				animator: harness.animator,
				tint: 0x57d7b2,
			}),
		);
		projectionState.main = [
			running,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);

		projectionState.main = [
			settled,
		];
		projectionState.feedback = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
	});

	it("dims a craft as soon as its active job starts collecting inputs", () => {
		const idle = createItem("runtime:craft", boardLocation, {
			itemType: ItemEnumSchema.enum.Craft,
		});
		const collecting = createItem(idle.id, boardLocation, {
			itemType: ItemEnumSchema.enum.Craft,
			jobStatus: JobStatusEnumSchema.enum.Paused,
		});
		const actor = createActor(idle);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			collecting,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.animations.find(({ channel }) => channel === "crowd-opacity")).toMatchObject(
			{
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: `running:${actor.item.id}`,
				toCrowdAlpha: 0.6,
			},
		);
	});

	it("dips a surviving consumed source and restores only that lifecycle intent", () => {
		const item = createItem("runtime:ore", boardLocation, {
			quantity: 2,
			revision: "revision:ore:2",
		});
		const actor = createActor(
			createItem(item.id, boardLocation, {
				quantity: 3,
				revision: "revision:ore:3",
			}),
		);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			item,
		];
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "2:0:consume-source",
				kind: "consume-source",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const dip = harness.animations.find(
			(animation) =>
				animation.actor === actor &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0.42,
		);
		expect(dip).toMatchObject({
			durationMs: 130,
			ownerKey: `actor-alpha:${actor.instanceId}`,
		});

		dip?.onComplete?.();
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 360,
				ownerKey: `actor-alpha:${actor.instanceId}`,
				toAlpha: 1,
			}),
		);
	});

	it("starts terminal deposit feedback before its longer fade-off releases the actor", () => {
		const item = createItem("runtime:depleted-tree", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "3:0:resource-spent",
				kind: "resource-spent",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.animations[0]).toMatchObject({
			actor,
			channel: "activity-particles",
			durationMs: 720,
			ownerKey: `activity-particles:${actor.instanceId}`,
		});
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 720,
				toAlpha: 0,
			}),
		);
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "pose",
				durationMs: 720,
				toScale: 0.76,
			}),
		);
		expect(actor.container.destroyed).toBe(false);
	});

	it("keeps the current visual visible until a complete incoming slot can crossfade", () => {
		const previous = createItem("runtime:producer", boardLocation, {
			itemId: "producer:idle",
			revision: "revision:producer-idle",
			sourceUrl: "resource:producer-idle",
			title: "Idle producer",
		});
		const current = createItem(previous.id, boardLocation, {
			itemId: "producer:running",
			revision: "revision:producer-running",
			running: true,
			activityEffect: true,
			sourceUrl: "resource:producer-running",
			title: "Running producer",
		});
		const actor = createActor(previous);
		const oldVisual = actor.currentVisual;
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			current,
		];
		projectionState.replacements = [
			{
				actorId: current.id,
				key: "2:0:replacement",
				previous: {
					compositeUrl: previous.compositeUrl,
					itemId: previous.itemId,
					sourceUrl: previous.sourceUrl,
					title: previous.title,
				},
				previousQuantity: previous.quantity,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const incoming = createdVisualState.created[0] as PixiTileActorVisual;
		expect(incoming).toBeDefined();
		expect(actor.currentVisual).toBe(oldVisual);
		expect(actor.pendingVisual).toBe(incoming);
		expect(oldVisual.container.destroyed).toBe(false);
		expect(oldVisual.container.alpha).toBe(1);
		expect(incoming.container.alpha).toBe(0);
		expect(harness.animations.some(({ channel }) => channel === "visual-mix")).toBe(false);

		Effect.runSync(
			completePixiTileActorVisualTextureLoadFx({
				generation: incoming.textureGeneration,
				visual: incoming,
			}),
		);
		const mix = harness.animations.find(({ channel }) => channel === "visual-mix");
		expect(mix).toMatchObject({
			actor,
			channel: "visual-mix",
			durationMs: replacementCrossfadeDurationMs,
			incoming: incoming.container,
			ownerKey: "replacement:2:0:replacement",
		});
		expect(mix?.channel === "visual-mix" ? mix.outgoing.alpha : null).toBe(1);
		expect(oldVisual.container.destroyed).toBe(false);

		mix?.onComplete?.();
		expect(actor.currentVisual).toBe(incoming);
		expect(actor.pendingVisual).toBeNull();
		expect(incoming.container.alpha).toBe(1);
		expect(oldVisual.container.destroyed).toBe(true);
		expect(actor.visuals).toEqual(
			new Set([
				incoming,
			]),
		);
		expect(harness.animations.find(({ channel }) => channel === "crowd-opacity")).toMatchObject(
			{
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: `running:${actor.item.id}`,
				toCrowdAlpha: 0.82,
			},
		);
		expect(
			harness.animations.find(({ channel }) => channel === "activity-particles"),
		).toMatchObject({
			actor,
			channel: "activity-particles",
			curve: {
				kind: "linear",
			},
			durationMs: 1_760,
			ownerKey: `activity-particles:${actor.instanceId}`,
			repeat: Number.POSITIVE_INFINITY,
		});
	});

	it("cannot resurrect rapid replacement visuals after the canonical actor exits", () => {
		const first = createItem("runtime:producer", boardLocation, {
			revision: "revision:first",
			sourceUrl: "resource:first",
		});
		const second = createItem(first.id, boardLocation, {
			revision: "revision:second",
			sourceUrl: "resource:second",
		});
		const third = createItem(first.id, boardLocation, {
			revision: "revision:third",
			sourceUrl: "resource:third",
		});
		const actor = createActor(first);
		const harness = createReconcilerHarness({
			actor,
		});

		projectionState.main = [
			second,
		];
		projectionState.replacements = [
			{
				actorId: first.id,
				key: "2:0:replacement",
				previous: {
					itemId: first.itemId,
					sourceUrl: first.sourceUrl,
					title: first.title,
				},
				previousQuantity: first.quantity,
			},
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const pendingSecond = createdVisualState.created[0] as PixiTileActorVisual;

		projectionState.main = [
			third,
		];
		projectionState.replacements = [
			{
				actorId: first.id,
				key: "3:0:replacement",
				previous: {
					itemId: second.itemId,
					sourceUrl: second.sourceUrl,
					title: second.title,
				},
				previousQuantity: second.quantity,
			},
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));
		const pendingThird = createdVisualState.created[1] as PixiTileActorVisual;
		expect(actor.pendingVisual).toBe(pendingThird);

		projectionState.main = [];
		projectionState.replacements = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(4)));
		const exit = harness.animations.find(
			(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 0,
		);
		expect(harness.actors.has(first.id)).toBe(false);
		expect(harness.canceledActors).toEqual([
			actor,
		]);

		Effect.runSync(
			completePixiTileActorVisualTextureLoadFx({
				generation: pendingSecond.textureGeneration,
				visual: pendingSecond,
			}),
		);
		Effect.runSync(
			completePixiTileActorVisualTextureLoadFx({
				generation: pendingThird.textureGeneration,
				visual: pendingThird,
			}),
		);
		expect(harness.animations.some(({ channel }) => channel === "visual-mix")).toBe(false);
		expect(actor.currentVisual.item.revision).toBe("revision:first");

		exit?.onComplete?.();
		expect(actor.container.destroyed).toBe(true);
		expect(actor.visuals.size).toBe(0);
		expect(pendingSecond.container.destroyed).toBe(true);
		expect(pendingThird.container.destroyed).toBe(true);

		Effect.runSync(
			completePixiTileActorVisualTextureLoadFx({
				generation: pendingThird.textureGeneration - 1,
				visual: pendingThird,
			}),
		);
		expect(actor.container.destroyed).toBe(true);
		expect(harness.actors.has(first.id)).toBe(false);
	});
});
