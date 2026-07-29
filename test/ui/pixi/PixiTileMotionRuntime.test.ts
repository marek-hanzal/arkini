// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import type {
	PixiActorAnimation,
	PixiActorAnimationChannel,
	PixiActorAnimator,
	PixiActorPresentationWrite,
} from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import {
	pixiTileActorRemovalFeedbackDurationMs,
	startPixiTileActorRemovalFeedbackFx,
} from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type {
	PixiTileMagneticField,
	PixiTileMagneticFieldSample,
} from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionRuntimeFx } from "~/ui/pixi/motion/createPixiTileMotionRuntimeFx";
import { finalizePixiTileMotionActorsFx } from "~/ui/pixi/motion/finalizePixiTileMotionActorsFx";
import { readPixiTileMotionOriginFx } from "~/ui/pixi/motion/readPixiTileMotionOriginFx";
import { runPixiInputMotionFx } from "~/ui/pixi/motion/runPixiInputMotionFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

vi.mock("~/ui/pixi/actor/createPixiTileActorFx", async () => {
	const { Effect: EffectModule } = await import("effect");
	const { Container: PixiContainer } = await import("pixi.js");
	return {
		createPixiTileActorFx: ({
			item,
		}: {
			readonly item: {
				readonly id: string;
			};
		}) => {
			const visual = {
				container: new PixiContainer(),
				item,
				readyListeners: new Set(),
				size: 80,
				textureGeneration: 0,
				textureState: "ready",
			};
			return EffectModule.succeed({
				activityParticles: {
					centerX: 40,
					container: new PixiContainer(),
					feedbackPhase: null,
					lastProgress: 0,
					lightSurface: false,
					particles: [
						{
							alphaScale: 1,
							particle: {
								alpha: 0,
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
					workingTint: 0xf05bb8,
				},
				container: new PixiContainer(),
				crowdLayer: new PixiContainer(),
				currentVisual: visual,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
				instanceId: `instance:${item.id}`,
				item,
				lifecycleDurationMs: 0,
				lifecycleFadeStarted: false,
				lifecycleIntentGeneration: 0,
				lifecycleNotBeforeMs: 0,
				lifecycleTargetAlpha: 0,
				offsetLayer: new PixiContainer(),
				onPointerDown: null,
				pendingVisual: null,
				size: 80,
				visualLayer: new PixiContainer(),
				visuals: new Set([
					visual,
				]),
				visualTransitionGeneration: 0,
			});
		},
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

const inventoryLocation = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};
const firstBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};
const secondBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};

const createItem = (
	id: string,
	location: TileActorItem["location"] = firstBoardLocation,
): TileActorItem => ({
	id,
	itemId: id,
	itemType: "simple",
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision: `revision:${id}`,
	running: false,
	activityEffect: false,
	sourceUrl: `resource:${id}`,
	title: id,
});

const createActor = (id: string) => {
	const item = createItem(id);
	const container = new Container();
	container.alpha = 0;
	const visual = {
		container: new Container(),
		item,
		readyListeners: new Set(),
		size: 80,
		textureGeneration: 0,
		textureState: "ready",
	} as unknown as PixiTileActorVisual;
	return {
		activityParticles: {
			centerX: 40,
			container: new Container(),
			feedbackPhase: null,
			lastProgress: 0,
			lightSurface: false,
			particles: [
				{
					alphaScale: 1,
					particle: {
						alpha: 0,
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
			workingTint: 0xf05bb8,
		},
		container,
		crowdLayer: new Container(),
		currentVisual: visual,
		dragging: false,
		dragOffsetX: 0,
		dragOffsetY: 0,
		instanceId: `instance:${id}`,
		item,
		lifecycleDurationMs: 0,
		lifecycleFadeStarted: false,
		lifecycleIntentGeneration: 0,
		lifecycleNotBeforeMs: 0,
		lifecycleTargetAlpha: 0,
		offsetLayer: new Container(),
		onPointerDown: null,
		pendingVisual: null,
		size: 80,
		visualLayer: new Container(),
		visuals: new Set([
			visual,
		]),
		visualTransitionGeneration: 0,
	} as unknown as PixiTileActor;
};

const applyPresentationWrite = (write: PixiActorPresentationWrite) => {
	switch (write.channel) {
		case "pose":
			write.actor.container.position.set(write.x, write.y);
			if (write.scale !== undefined) write.actor.container.scale.set(write.scale);
			return;
		case "lifecycle-opacity":
			write.actor.container.alpha = write.alpha;
			return;
		case "crowd-opacity":
			write.actor.crowdLayer.alpha = write.alpha;
			return;
		case "activity-particles":
			write.actor.activityParticles.container.visible = write.visible;
	}
};

const createRecordingAnimator = ({
	animations,
	canceledOwnerKeys = [],
}: {
	readonly animations: PixiActorAnimation[];
	readonly canceledOwnerKeys?: string[];
}): PixiActorAnimator => ({
	animateFx: (animation) =>
		Effect.sync(() => {
			animations.push(animation);
		}),
	cancelActorFx: () => Effect.void,
	cancelChannelFx: () => Effect.void,
	cancelFx: (ownerKey) =>
		Effect.sync(() => {
			canceledOwnerKeys.push(ownerKey);
			[
				...animations,
			]
				.reverse()
				.find((animation) => animation.ownerKey === ownerKey)
				?.onCancel?.();
		}),
	closeFx: Effect.void,
	isChannelActiveFx: () => Effect.succeed(false),
	setFx: (write) =>
		Effect.sync(() => {
			applyPresentationWrite(write);
		}),
});

const createRecordingMagneticField = ({
	releases = [],
	updates = [],
}: {
	readonly releases?: Array<{
		readonly sourceActorId: string;
		readonly sourceKind: "drag" | "motion";
	}>;
	readonly updates?: PixiTileMagneticFieldSample[];
} = {}): PixiTileMagneticField => {
	const activeSources = new Map<string, PixiTileMagneticFieldSample>();
	const readSourceKey = (
		sourceKind: "drag" | "motion",
		sourceActorId: string,
		sourceInstanceId: string,
	) =>
		JSON.stringify([
			sourceKind,
			sourceActorId,
			sourceInstanceId,
		]);
	return {
		closeFx: Effect.void,
		flushFx: Effect.void,
		pruneFx: Effect.void,
		readActiveSourceActorIdsFx: Effect.sync(() =>
			Array.from(activeSources.values(), ({ sourceActorId }) => sourceActorId),
		),
		releaseFx: (source) =>
			Effect.sync(() => {
				if (
					!activeSources.delete(
						readSourceKey(
							source.sourceKind,
							source.sourceActorId,
							source.sourceInstanceId,
						),
					)
				)
					return;
				releases.push({
					sourceActorId: source.sourceActorId,
					sourceKind: source.sourceKind,
				});
			}),
		releaseSourcesFx: (sourceKind) =>
			Effect.sync(() => {
				for (const [key, sample] of activeSources) {
					if ((sample.sourceKind ?? "drag") !== sourceKind) continue;
					activeSources.delete(key);
					releases.push({
						sourceActorId: sample.sourceActorId,
						sourceKind,
					});
				}
			}),
		resetFx: Effect.void,
		subscribeSourceMembershipFx: () => Effect.succeed(() => {}),
		updateFx: (sample) =>
			Effect.sync(() => {
				updates.push(sample);
				const sourceKind = sample.sourceKind ?? "drag";
				activeSources.set(
					readSourceKey(sourceKind, sample.sourceActorId, sample.sourceInstanceId),
					sample,
				);
			}),
	};
};

const readPoseAnimation = (animations: ReadonlyArray<PixiActorAnimation>, actor: PixiTileActor) => {
	const animation = animations.find(
		(candidate) => candidate.actor === actor && candidate.channel === "pose",
	);
	if (animation?.channel !== "pose") throw new Error("Expected a pose animation.");
	return animation;
};

const samplePoseAnimation = (
	animation: Extract<
		PixiActorAnimation,
		{
			readonly channel: "pose";
		}
	>,
	progress: number,
) => {
	const pose = animation.readPose?.(progress);
	if (pose === undefined) throw new Error("Expected a semantic pose sampler.");
	animation.actor.container.position.set(pose.x, pose.y);
	if (pose.scale !== undefined) animation.actor.container.scale.set(pose.scale);
	return pose;
};

const completeInputRemainderFlash = ({
	actor,
	animations,
	cancelFadeIn = false,
	cueKey,
	expectedQuantity,
}: {
	readonly actor: PixiTileActor;
	readonly animations: ReadonlyArray<PixiActorAnimation>;
	readonly cancelFadeIn?: boolean;
	readonly cueKey: string;
	readonly expectedQuantity: number;
}) => {
	const fadeOut = animations.find(
		(animation) =>
			animation.actor === actor &&
			animation.channel === "lifecycle-opacity" &&
			animation.ownerKey === `motion:${cueKey}:consume` &&
			animation.toAlpha === 0,
	);
	if (fadeOut?.channel !== "lifecycle-opacity") {
		throw new Error("Expected the input consumption fade-out.");
	}
	const previousQuantity = actor.item.quantity;
	expect(fadeOut.durationMs).toBe(275);
	fadeOut.onComplete?.();
	expect(previousQuantity).not.toBe(expectedQuantity);
	expect(actor.item.quantity).toBe(expectedQuantity);
	expect(actor.item.badgeCount).toBe(expectedQuantity > 1 ? expectedQuantity : undefined);

	const fadeIn = animations.find(
		(animation) =>
			animation.actor === actor &&
			animation.channel === "lifecycle-opacity" &&
			animation.ownerKey === `motion:${cueKey}:consume` &&
			animation.toAlpha === 1,
	);
	if (fadeIn?.channel !== "lifecycle-opacity") {
		throw new Error("Expected the input remainder fade-in.");
	}
	expect(fadeIn.durationMs).toBe(375);
	(cancelFadeIn ? fadeIn.onCancel : fadeIn.onComplete)?.();
	expect(actor.item.quantity).toBe(expectedQuantity);
};

const completeStackMergeVanish = ({
	actor,
	animations,
}: {
	readonly actor: PixiTileActor;
	readonly animations: ReadonlyArray<PixiActorAnimation>;
}) => {
	const vanishPose = animations
		.filter((animation) => animation.actor === actor && animation.channel === "pose")
		.at(-1);
	if (vanishPose?.channel !== "pose") throw new Error("Expected stack merge vanish pose.");
	expect(vanishPose.durationMs).toBe(260);
	expect(vanishPose.toScale).toBeCloseTo(actor.container.scale.x * 0.72);
	const vanishOpacity = animations
		.filter(
			(animation) =>
				animation.actor === actor &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		)
		.at(-1);
	if (vanishOpacity?.channel !== "lifecycle-opacity") {
		throw new Error("Expected stack merge vanish opacity.");
	}
	expect(vanishOpacity.durationMs).toBe(260);
	vanishOpacity.onComplete?.();
};

const createSwapHarness = ({
	includeSource = true,
	includeTarget = true,
}: {
	readonly includeSource?: boolean;
	readonly includeTarget?: boolean;
} = {}) => {
	const source = createActor("runtime:source");
	const target = createActor("runtime:target");
	source.container.x = 245;
	source.container.y = 47;
	target.container.x = 200;
	target.container.y = 40;
	source.item = createItem(source.item.id, secondBoardLocation);
	target.item = createItem(target.item.id, firstBoardLocation);
	const actors = new Map([
		...(includeSource
			? [
					[
						source.item.id,
						source,
					] as const,
				]
			: []),
		...(includeTarget
			? [
					[
						target.item.id,
						target,
					] as const,
				]
			: []),
	]);
	const canonicalItems = new Map([
		[
			source.item.id,
			source.item,
		],
		[
			target.item.id,
			target.item,
		],
	]);
	const exitingActors = new Set<PixiTileActor>();
	const animations: PixiActorAnimation[] = [];
	const canceledAnimationKeys: string[] = [];
	const magneticReleases: Array<{
		readonly sourceActorId: string;
		readonly sourceKind: "drag" | "motion";
	}> = [];
	const magneticUpdates: PixiTileMagneticFieldSample[] = [];
	const transientActorLayer = new Container();
	let geometry = {
		size: 80,
		stepX: 100,
		y: 40,
	};
	const readPose = (location: TileActorItem["location"]) => ({
		layer: transientActorLayer,
		size: geometry.size,
		x: location.position.x * geometry.stepX,
		y: geometry.y,
	});
	const runtime = Effect.runSync(
		createPixiTileMotionRuntimeFx({
			actorStore: {
				actors,
				canonicalItems,
				deleteActorFx: (actorId: string) =>
					Effect.sync(() => {
						const actor = actors.get(actorId) ?? null;
						actors.delete(actorId);
						return actor;
					}),
				destroyExitingActorFx: (actor: PixiTileActor) =>
					Effect.sync(() => {
						exitingActors.delete(actor);
						actor.container.destroy({
							children: true,
						});
					}),
				releaseActorFx: (actorId: string) =>
					Effect.sync(() => {
						const actor = actors.get(actorId) ?? null;
						actors.delete(actorId);
						if (actor !== null) exitingActors.add(actor);
						return actor;
					}),
			} as unknown as PixiMainSceneActorStore,
			animator: createRecordingAnimator({
				animations,
				canceledOwnerKeys: canceledAnimationKeys,
			}),
			application: {
				app: {
					canvas: {
						getBoundingClientRect: () => ({
							left: 0,
							top: 0,
						}),
					},
				},
				frames: {
					invalidateFx: Effect.void,
				},
			} as unknown as PixiApplicationOwner,
			magneticField: createRecordingMagneticField({
				releases: magneticReleases,
				updates: magneticUpdates,
			}),
			readPalette: () => ({}) as PixiScenePalette,
			surface: {
				readLocalActorIdsFx: () => Effect.succeed([]),
				readActorPoseFx: (item: TileActorItem) => Effect.succeed(readPose(item.location)),
				readLocationPoseFx: (location: TileActorItem["location"]) =>
					Effect.succeed(readPose(location)),
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
			textures: {} as never,
		}),
	);
	const cue = {
		actorId: target.item.id,
		counterpartActorId: source.item.id,
		eventIndex: 0,
		kind: "swap",
		originActorId: target.item.id,
		originLocation: secondBoardLocation,
		sequence: 9,
		staggerIndex: 0,
		targetLocation: firstBoardLocation,
	} satisfies TileMotionCue;
	return {
		actors,
		animations,
		canceledAnimationKeys,
		canonicalItems,
		cue,
		exitingActors,
		magneticReleases,
		magneticUpdates,
		runtime,
		setGeometry: (next: typeof geometry) => {
			geometry = next;
		},
		source,
		target,
	};
};

const createSpawnHarness = () => {
	const blocker = createActor("runtime:spawn-blocker");
	const spawned = createActor("runtime:spawn-target");
	blocker.item = createItem(blocker.item.id, secondBoardLocation);
	spawned.item = createItem(spawned.item.id, firstBoardLocation);
	blocker.container.position.set(200, 40);
	spawned.container.position.set(40, 60);
	const actors = new Map([
		[
			blocker.item.id,
			blocker,
		],
		[
			spawned.item.id,
			spawned,
		],
	]);
	const canonicalItems = new Map([
		[
			blocker.item.id,
			blocker.item,
		],
		[
			spawned.item.id,
			spawned.item,
		],
	]);
	const animations: PixiActorAnimation[] = [];
	const canceledAnimationKeys: string[] = [];
	const magneticReleases: Array<{
		readonly sourceActorId: string;
		readonly sourceKind: "drag" | "motion";
	}> = [];
	const magneticUpdates: PixiTileMagneticFieldSample[] = [];
	const transientActorLayer = new Container();
	const readPose = (location: TileActorItem["location"]) => ({
		layer: transientActorLayer,
		size: 80,
		x: location.position.x * 100,
		y: 40,
	});
	const runtime = Effect.runSync(
		createPixiTileMotionRuntimeFx({
			actorStore: {
				actors,
				canonicalItems,
				deleteActorFx: (actorId: string) =>
					Effect.sync(() => {
						const actor = actors.get(actorId) ?? null;
						actors.delete(actorId);
						return actor;
					}),
			} as unknown as PixiMainSceneActorStore,
			animator: createRecordingAnimator({
				animations,
				canceledOwnerKeys: canceledAnimationKeys,
			}),
			application: {
				app: {
					canvas: {
						getBoundingClientRect: () => ({
							left: 0,
							top: 0,
						}),
					},
				},
				frames: {
					invalidateFx: Effect.void,
				},
			} as unknown as PixiApplicationOwner,
			magneticField: createRecordingMagneticField({
				releases: magneticReleases,
				updates: magneticUpdates,
			}),
			readPalette: () => ({}) as PixiScenePalette,
			surface: {
				readLocalActorIdsFx: () => Effect.succeed([]),
				readActorPoseFx: (item: TileActorItem) => Effect.succeed(readPose(item.location)),
				readLocationPoseFx: (location: TileActorItem["location"]) =>
					Effect.succeed(readPose(location)),
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
			textures: {} as never,
		}),
	);
	const blockerCue = {
		actorId: blocker.item.id,
		eventIndex: 0,
		kind: "spawn",
		originActorId: "runtime:producer",
		originLocation: firstBoardLocation,
		sequence: 10,
		staggerIndex: 0,
		targetLocation: secondBoardLocation,
	} satisfies TileMotionCue;
	const spawnCue = {
		actorId: spawned.item.id,
		eventIndex: 0,
		kind: "spawn",
		originActorId: "runtime:producer",
		originLocation: secondBoardLocation,
		sequence: 11,
		staggerIndex: 0,
		targetLocation: firstBoardLocation,
	} satisfies TileMotionCue;
	return {
		animations,
		blocker,
		blockerCue,
		canceledAnimationKeys,
		magneticReleases,
		magneticUpdates,
		runtime,
		spawnCue,
		spawned,
	};
};

const createStackHarness = () => {
	const target = createActor("runtime:stack-target");
	target.item = createItem(target.item.id, secondBoardLocation);
	target.container.position.set(200, 40);
	const canonicalTarget = {
		...target.item,
		quantity: 2,
	};
	const actors = new Map([
		[
			target.item.id,
			target,
		],
	]);
	const canonicalItems = new Map([
		[
			target.item.id,
			canonicalTarget,
		],
	]);
	const animations: PixiActorAnimation[] = [];
	const canceledOwnerKeys: string[] = [];
	const magneticReleases: Array<{
		readonly sourceActorId: string;
		readonly sourceKind: "drag" | "motion";
	}> = [];
	const magneticUpdates: PixiTileMagneticFieldSample[] = [];
	const actorLayer = new Container();
	const transientActorLayer = new Container();
	const animator = createRecordingAnimator({
		animations,
		canceledOwnerKeys,
	});
	const readPose = (location: TileActorItem["location"]) => ({
		layer: actorLayer,
		size: 80,
		x: location.position.x * 100,
		y: 40,
	});
	const runtime = Effect.runSync(
		createPixiTileMotionRuntimeFx({
			actorStore: {
				actors,
				canonicalItems,
				deleteActorFx: (actorId: string) =>
					Effect.sync(() => {
						const actor = actors.get(actorId) ?? null;
						actors.delete(actorId);
						return actor;
					}),
			} as unknown as PixiMainSceneActorStore,
			animator,
			application: {
				app: {
					canvas: {
						getBoundingClientRect: () => ({
							left: 0,
							top: 0,
						}),
					},
				},
				frames: {
					invalidateFx: Effect.void,
				},
			} as unknown as PixiApplicationOwner,
			magneticField: createRecordingMagneticField({
				releases: magneticReleases,
				updates: magneticUpdates,
			}),
			readPalette: () => ({}) as PixiScenePalette,
			surface: {
				readLocalActorIdsFx: () => Effect.succeed([]),
				readActorPoseFx: (item: TileActorItem) => Effect.succeed(readPose(item.location)),
				readLocationPoseFx: (location: TileActorItem["location"]) =>
					Effect.succeed(readPose(location)),
				transientActorLayer,
			} as unknown as PixiMainSceneSurface,
			textures: {} as never,
		}),
	);
	const cue = {
		canonicalItemId: target.item.itemId,
		eventIndex: 0,
		kind: "stack",
		originActorId: "runtime:producer",
		originLocation: firstBoardLocation,
		quantity: 1,
		sequence: 30,
		staggerIndex: 0,
		targetActorId: target.item.id,
		targetLocation: secondBoardLocation,
	} satisfies TileMotionCue;
	return {
		actors,
		animator,
		animations,
		canceledOwnerKeys,
		canonicalItems,
		cue,
		magneticReleases,
		magneticUpdates,
		runtime,
		target,
	};
};

describe("Pixi tile motion runtime", () => {
	it("presents a produced stack payload with its exact delta instead of the target total", () => {
		const { animations, cue, runtime } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				{
					...cue,
					quantity: 2,
				},
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a produced stack payload.");
		expect(travel.actor.item.quantity).toBe(2);
		expect(travel.actor.item.badgeCount).toBe(2);
		Effect.runSync(runtime.closeFx);
	});

	it("isolates concurrent cue payload lifecycles across completion and close", () => {
		const { actors, animations, canonicalItems, cue, runtime } = createStackHarness();
		const secondTarget = createActor("runtime:second-stack-target");
		secondTarget.item = createItem(secondTarget.item.id, {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		});
		actors.set(secondTarget.item.id, secondTarget);
		canonicalItems.set(secondTarget.item.id, {
			...secondTarget.item,
			quantity: 2,
		});
		const secondCue = {
			...cue,
			eventIndex: 1,
			targetActorId: secondTarget.item.id,
			targetLocation: secondTarget.item.location,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				secondCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		const secondTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:1",
		);
		if (firstTravel?.channel !== "pose" || secondTravel?.channel !== "pose") {
			throw new Error("Expected both concurrent stack payloads.");
		}
		const firstDestroy = vi.spyOn(firstTravel.actor.container, "destroy");
		const secondDestroy = vi.spyOn(secondTravel.actor.container, "destroy");

		samplePoseAnimation(firstTravel, 1);
		firstTravel.onComplete?.();
		completeStackMergeVanish({
			actor: firstTravel.actor,
			animations,
		});

		expect(firstTravel.actor.container.destroyed).toBe(true);
		expect(firstDestroy).toHaveBeenCalledOnce();
		expect(secondTravel.actor.container.destroyed).toBe(false);
		expect(secondDestroy).not.toHaveBeenCalled();

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);

		expect(firstDestroy).toHaveBeenCalledOnce();
		expect(secondTravel.actor.container.destroyed).toBe(true);
		expect(secondDestroy).toHaveBeenCalledOnce();
	});

	it("ignores a queued proximity settlement after the pose writer is superseded", async () => {
		const actor = createActor("runtime:proximity-cancel");
		actor.container.position.set(0, 0);
		const animations: PixiActorAnimation[] = [];
		const poseState: {
			active: Extract<
				PixiActorAnimation,
				{
					readonly channel: "pose";
				}
			> | null;
		} = {
			active: null,
		};
		const onSettled = vi.fn();
		const animator = {
			...createRecordingAnimator({
				animations,
			}),
			animateFx: (animation: PixiActorAnimation) =>
				Effect.sync(() => {
					animations.push(animation);
					if (animation.channel === "pose") poseState.active = animation;
				}),
			cancelChannelFx: (_actor: PixiTileActor, channel: PixiActorAnimationChannel) =>
				Effect.sync(() => {
					if (channel !== "pose" || poseState.active === null) return;
					const canceled = poseState.active;
					poseState.active = null;
					canceled.onCancel?.();
				}),
		} satisfies PixiActorAnimator;
		Effect.runSync(
			chasePixiTileMotionTargetFx({
				actor,
				animator,
				fallbackTarget: {
					layer: new Container(),
					size: 80,
					x: 100,
					y: 0,
				},
				onSettled,
				ownerKey: "test:proximity-cancel",
				readLiveTarget: () => ({
					scale: 1,
					x: 100,
					y: 0,
				}),
				settleWithinTileRatio: 0.5,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readLocationPoseFx: () =>
						Effect.succeed({
							layer: new Container(),
							size: 80,
							x: 100,
							y: 0,
						}),
				} as unknown as PixiMainSceneSurface,
				targetLocation: secondBoardLocation,
			}),
		);
		const travel = poseState.active;
		if (travel === null) throw new Error("Expected proximity travel.");
		const pose = travel.readPose?.(0.7);
		if (pose === undefined) throw new Error("Expected proximity pose.");
		actor.container.position.set(pose.x, pose.y);
		Effect.runSync(animator.cancelChannelFx(actor, "pose"));
		await Promise.resolve();
		expect(onSettled).not.toHaveBeenCalled();
	});

	it("launches produced payloads from the held producer's live presentation pose", () => {
		const { actors, animations, cue, runtime } = createStackHarness();
		const producer = createActor(cue.originActorId);
		producer.dragging = true;
		producer.container.position.set(460, 300);
		producer.container.pivot.set(16, 12);
		producer.container.scale.set(1.25);
		producer.offsetLayer.position.set(5, -4);
		actors.set(producer.item.id, producer);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		expect(travel.actor.container).toMatchObject({
			x: 446.25,
			y: 280,
		});
		expect(travel.actor.container.scale.x).toBe(1.25);
		expect(travel.actor.container.x).not.toBe(100);
		expect(travel.actor.container.y).not.toBe(40);

		Effect.runSync(runtime.closeFx);
	});

	it("hard-snaps a stack merge inside the half-tile live-target field", async () => {
		const { animations, cue, magneticReleases, runtime, target } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");

		target.container.x = 260;
		samplePoseAnimation(travel, 0.8);
		samplePoseAnimation(travel, 0.9);
		target.container.x = 600;
		await Promise.resolve();
		expect(travel.actor.container.destroyed).toBe(false);

		target.container.x = 260;
		samplePoseAnimation(travel, 0.95);
		await Promise.resolve();
		expect(travel.actor.container).toMatchObject({
			x: target.container.x,
			y: target.container.y,
		});
		expect(travel.actor.container.scale.x).toBe(target.container.scale.x);
		expect(magneticReleases).not.toContainEqual({
			sourceActorId: travel.actor.item.id,
			sourceKind: "motion",
		});
		completeStackMergeVanish({
			actor: travel.actor,
			animations,
		});
		expect(travel.actor.container.destroyed).toBe(true);
		expect(target.item.quantity).toBe(2);
		expect(magneticReleases).toContainEqual({
			sourceActorId: travel.actor.item.id,
			sourceKind: "motion",
		});
		Effect.runSync(runtime.closeFx);
	});

	it("stacks a consumed source with its one retained physical actor", () => {
		const { actors, animations, animator, canonicalItems, cue, runtime, target } =
			createStackHarness();
		const source = createActor(cue.originActorId);
		source.item = {
			...source.item,
			itemId: cue.canonicalItemId,
			quantity: cue.quantity,
		};
		source.container.alpha = 1;
		source.container.position.set(100, 40);
		source.container.pivot.set(30, 18);
		actors.set(source.item.id, source);
		canonicalItems.delete(source.item.id);
		Effect.runSync(
			startPixiTileActorRemovalFeedbackFx({
				actor: source,
				animator,
			}),
		);
		source.container.alpha = 0.35;

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected the source stack travel.");
		expect(travel.actor).toBe(source);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === source && animation.channel === "lifecycle-opacity",
			),
		).toEqual([
			expect.objectContaining({
				toAlpha: 0,
			}),
			expect.objectContaining({
				toAlpha: 1,
			}),
		]);
		expect(source.lifecycleTargetAlpha).toBe(1);
		samplePoseAnimation(travel, 1);
		expect({
			x: source.container.x - source.container.pivot.x * source.container.scale.x,
			y: source.container.y - source.container.pivot.y * source.container.scale.y,
		}).toEqual({
			x: target.container.x - target.container.pivot.x * target.container.scale.x,
			y: target.container.y - target.container.pivot.y * target.container.scale.y,
		});
		travel.onComplete?.();
		completeStackMergeVanish({
			actor: source,
			animations,
		});

		expect(source.container.destroyed).toBe(true);
		expect(actors.has(source.item.id)).toBe(false);
		expect(target.item.quantity).toBe(2);
		Effect.runSync(runtime.closeFx);
	});

	it("chases a moving input owner and returns its remainder to the stable engine origin", () => {
		const source = createActor("runtime:input-source");
		const owner = createActor("runtime:input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			badgeCount: 7,
			quantity: 7,
		};
		source.currentVisual.item = source.item;
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(125, 40);
		source.container.alpha = 1;
		source.container.eventMode = "static";
		source.offsetLayer.position.set(5, -4);
		owner.container.position.set(200, 40);
		owner.container.alpha = 1;
		const canonicalSource = {
			...source.item,
			quantity: 2,
			revision: "revision:input-source:stored",
		};
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				owner.item.id,
				owner,
			],
		]);
		const canonicalItems = new Map([
			[
				source.item.id,
				canonicalSource,
			],
			[
				owner.item.id,
				owner.item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const magneticReleases: Array<{
			readonly sourceActorId: string;
			readonly sourceKind: "drag" | "motion";
		}> = [];
		const magneticUpdates: PixiTileMagneticFieldSample[] = [];
		const transientActorLayer = new Container();
		const actorLayer = new Container();
		const readPose = (location: TileActorItem["location"]) => ({
			layer: actorLayer,
			size: 80,
			x: location.position.x * 100,
			y: 40,
		});
		const runtime = Effect.runSync(
			createPixiTileMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application: {
					app: {
						canvas: {
							getBoundingClientRect: () => ({
								left: 0,
								top: 0,
							}),
						},
					},
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				magneticField: createRecordingMagneticField({
					releases: magneticReleases,
					updates: magneticUpdates,
				}),
				readPalette: () => ({}) as PixiScenePalette,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed(readPose(item.location)),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(readPose(location)),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 7,
			storedQuantity: 5,
			resultingQuantity: 2,
			sequence: 40,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		const effectivePoseBeforeSetup = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.syncPresentationFx);
		Effect.runSync(runtime.startFx);

		expect(source.item.quantity).toBe(7);
		expect(source.container.alpha).toBe(1);
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeSetup);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map([
				[
					source.item.id,
					"activation-only",
				],
			]),
			retainedActorIds: new Set([
				source.item.id,
				owner.item.id,
			]),
			quantityPresentationByActorId: new Map([
				[
					source.item.id,
					{
						kind: "exact",
						quantity: 7,
					},
				],
			]),
		});
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:40:0",
		);
		if (firstTravel?.channel !== "pose") {
			throw new Error("Expected the first input delivery segment.");
		}
		expect(firstTravel).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
		});
		const transient = firstTravel.actor;
		expect(transient).toBe(source);
		expect(transient.item.quantity).toBe(7);
		expect(transient.container.x).toBe(125);
		samplePoseAnimation(firstTravel, 1);
		owner.container.x = 340;
		firstTravel.onComplete?.();

		const travelSegments = animations.filter(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "pose" &&
				animation.ownerKey === "motion:40:0",
		);
		expect(travelSegments).toHaveLength(2);
		const finalTravel = travelSegments[1];
		if (finalTravel?.channel !== "pose") {
			throw new Error("Expected the retargeted input delivery segment.");
		}
		expect(finalTravel).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(0);
		samplePoseAnimation(finalTravel, 1);
		source.dragging = true;
		finalTravel.onComplete?.();

		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(1);
		expect(source.item.quantity).toBe(7);
		completeInputRemainderFlash({
			actor: transient,
			animations,
			cancelFadeIn: true,
			cueKey: "40:0",
			expectedQuantity: 2,
		});
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map([
				[
					source.item.id,
					{
						kind: "exact",
						quantity: 2,
					},
				],
			]),
		);
		Effect.runSync(runtime.syncPresentationFx);
		expect(source.item.quantity).toBe(2);
		expect(source.item.badgeCount).toBe(2);
		expect(source.container.alpha).toBe(1);
		expect(transient.item.quantity).toBe(2);
		const returnTravel = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:40:0",
			)
			.at(-1);
		if (returnTravel?.channel !== "pose") {
			throw new Error("Expected the input remainder return.");
		}
		expect(returnTravel).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(returnTravel.durationMs).toBe(
			Effect.runSync(
				readPixiTileTravelDurationMsFx({
					fromX: 340,
					fromY: 40,
					tileSize: 80,
					toX: 100,
					toY: 40,
				}),
			),
		);
		expect(samplePoseAnimation(returnTravel, 1)).toEqual({
			scale: 1,
			x: 100,
			y: 40,
		});
		const effectivePoseBeforeCompletion = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		source.dragging = false;
		returnTravel.onComplete?.();

		expect(transient.container.destroyed).toBe(false);
		expect(source.item.quantity).toBe(2);
		expect(source.container.x).toBe(100);
		expect(source.container.alpha).toBe(1);
		expect(source.container.eventMode).toBe("static");
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeCompletion);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map(),
			retainedActorIds: new Set(),
			quantityPresentationByActorId: new Map(),
		});
		expect(
			animations.filter(
				(animation) =>
					animation.actor === owner && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: null,
			eligibleAttractionActorIds: new Set([
				source.item.id,
			]),
			sourceActorId: transient.item.id,
			sourceKind: "motion",
		});
		expect(
			magneticReleases.filter((release) => release.sourceActorId === transient.item.id),
		).toHaveLength(2);
		Effect.runSync(runtime.closeFx);
	});

	it("returns a directly dropped input remainder with the same physical actor", () => {
		const source = createActor("runtime:dragged-input-source");
		const owner = createActor("runtime:dragged-input-owner");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			badgeCount: 8,
			quantity: 8,
		};
		source.currentVisual.item = source.item;
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.alpha = 1;
		source.container.eventMode = "static";
		source.container.position.set(280, 40);
		source.offsetLayer.position.set(6, -4);
		owner.container.position.set(300, 40);
		const actorLayer = new Container();
		const transientActorLayer = new Container();
		transientActorLayer.addChild(source.container);
		actorLayer.addChild(owner.container);
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				owner.item.id,
				owner,
			],
		]);
		const canonicalItems = new Map([
			[
				source.item.id,
				{
					...source.item,
					badgeCount: 7,
					quantity: 7,
				},
			],
			[
				owner.item.id,
				owner.item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const completed = vi.fn();
		const transients: PixiTileActor[] = [];
		const home = {
			layer: actorLayer,
			size: 80,
			x: 100,
			y: 40,
		};
		const target = {
			layer: actorLayer,
			size: 80,
			x: 300,
			y: 40,
		};
		const application = {
			frames: {
				invalidateFx: Effect.void,
			},
		} as unknown as PixiApplicationOwner;
		const surface = {
			readLocalActorIdsFx: () => Effect.succeed([]),
			readLocationPoseFx: (location: TileActorItem["location"]) =>
				Effect.succeed(location === firstBoardLocation ? home : target),
			transientActorLayer,
		} as unknown as PixiMainSceneSurface;
		const effectivePoseBeforeSetup = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		const origin = Effect.runSync(
			readPixiTileMotionOriginFx({
				originActor: source,
				originLocation: firstBoardLocation,
				surface,
			}),
		);
		if (origin === null) throw new Error("Expected the dragged actor origin.");
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 8,
			storedQuantity: 1,
			resultingQuantity: 7,
			sequence: 42,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;

		Effect.runSync(
			runPixiInputMotionFx({
				actorStore: {
					actors,
					canonicalItems,
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application,
				cue,
				cueKey: "42:0",
				delayMs: 0,
				magneticField: createRecordingMagneticField(),
				onComplete: completed,
				onRemainderRevealed: () => {
					source.item = {
						...source.item,
						badgeCount: 7,
						quantity: 7,
					};
					source.currentVisual.item = source.item;
				},
				onPayloadCreated: (actor) => {
					transients.push(actor);
				},
				origin,
				readPalette: () => ({}) as PixiScenePalette,
				readSourceSurvives: () => true,
				surface,
				target,
				textures: {} as never,
			}),
		);

		expect(transients).toEqual([]);
		expect(source.item.quantity).toBe(8);
		expect(source.item.badgeCount).toBe(8);
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeSetup);
		expect(source.container).toMatchObject({
			alpha: 1,
			eventMode: "none",
			parent: transientActorLayer,
			x: 280,
			y: 40,
		});
		const delivery = readPoseAnimation(animations, source);
		samplePoseAnimation(delivery, 1);
		delivery.onComplete?.();
		completeInputRemainderFlash({
			actor: source,
			animations,
			cueKey: "42:0",
			expectedQuantity: 7,
		});

		const returned = animations
			.filter(
				(animation) =>
					animation.actor === source &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:42:0",
			)
			.at(-1);
		if (returned?.channel !== "pose") throw new Error("Expected the input remainder return.");
		expect(samplePoseAnimation(returned, 0.5)).toMatchObject({
			x: 200,
			y: 40,
		});
		expect(samplePoseAnimation(returned, 1)).toEqual({
			scale: 1,
			x: home.x,
			y: home.y,
		});
		const effectivePoseBeforeCompletion = {
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		};
		returned.onComplete?.();

		expect(source.container.destroyed).toBe(false);
		expect(source.container).toMatchObject({
			alpha: 1,
			eventMode: "static",
			parent: actorLayer,
			x: 100,
			y: 40,
		});
		expect({
			x: source.container.x + source.offsetLayer.x * source.container.scale.x,
			y: source.container.y + source.offsetLayer.y * source.container.scale.y,
		}).toEqual(effectivePoseBeforeCompletion);
		expect(source.item.quantity).toBe(7);
		expect(completed).toHaveBeenCalledOnce();
	});

	it("spawns an Inventory autofill payload at its physical opener and uses ordinary input travel", () => {
		const opener = createActor("runtime:inventory-opener");
		const owner = createActor("runtime:inventory-input-owner");
		const sourceItem = {
			...createItem("runtime:inventory-source", inventoryLocation),
			quantity: 2,
		};
		opener.item = createItem(opener.item.id, {
			scope: "toolbar",
			position: {
				x: 0,
				y: 0,
			},
		});
		owner.item = createItem(owner.item.id, secondBoardLocation);
		opener.container.position.set(500, 24);
		owner.container.position.set(200, 40);
		const actors = new Map([
			[
				opener.item.id,
				opener,
			],
			[
				owner.item.id,
				owner,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const animator = createRecordingAnimator({
			animations,
		});
		const transientActorLayer = new Container();
		const openerPose = {
			layer: transientActorLayer,
			size: 64,
			x: 500,
			y: 24,
		};
		const targetPose = {
			layer: transientActorLayer,
			size: 80,
			x: 200,
			y: 40,
		};
		const completed = vi.fn();
		const transients: PixiTileActor[] = [];
		const cue = {
			canonicalItemId: sourceItem.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: opener.item.id,
			originLocation: opener.item.location,
			previousQuantity: 2,
			storedQuantity: 1,
			resultingQuantity: 1,
			sequence: 44,
			sourceActorId: sourceItem.id,
			sourceItem,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: owner.item.location,
		} satisfies TileMotionCue;

		Effect.runSync(
			runPixiInputMotionFx({
				actorStore: {
					actors,
					canonicalItems: new Map([
						[
							owner.item.id,
							owner.item,
						],
					]),
				} as unknown as PixiMainSceneActorStore,
				animator,
				application: {
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				cue,
				cueKey: "44:0",
				delayMs: 0,
				magneticField: createRecordingMagneticField(),
				onComplete: completed,
				onRemainderRevealed: () => {},
				onPayloadCreated: (actor) => {
					transients.push(actor);
				},
				origin: openerPose,
				readPalette: () => ({}) as PixiScenePalette,
				readSourceSurvives: () => true,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(location.scope === "toolbar" ? openerPose : targetPose),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				target: targetPose,
				textures: {} as never,
			}),
		);

		const transient = transients[0];
		if (transient === undefined) throw new Error("Expected Inventory input transient.");
		expect(transient.item).toMatchObject({
			badgeCount: 2,
			id: "motion:44:0",
			itemId: sourceItem.itemId,
			quantity: 2,
		});
		expect(transient.container).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		const delivery = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:44:0",
		);
		if (delivery?.channel !== "pose") throw new Error("Expected Inventory input delivery.");
		expect(delivery).toMatchObject({
			curve: {
				bounce: 0.1,
				kind: "spring",
			},
		});
		const deliveryTarget = samplePoseAnimation(delivery, 1);
		const deliveryOvershoot = samplePoseAnimation(delivery, 1.05);
		expect(deliveryOvershoot.x - deliveryTarget.x).toBeCloseTo(
			(deliveryTarget.x - openerPose.x) * 0.05,
		);
		expect(deliveryOvershoot.y - deliveryTarget.y).toBeCloseTo(
			(deliveryTarget.y - openerPose.y) * 0.05,
		);
		samplePoseAnimation(delivery, 1);
		delivery.onComplete?.();

		expect(transient.item.quantity).toBe(2);
		completeInputRemainderFlash({
			actor: transient,
			animations,
			cueKey: "44:0",
			expectedQuantity: 1,
		});
		expect(transient.item.badgeCount).toBeUndefined();
		const returned = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:44:0",
			)
			.at(-1);
		if (returned?.channel !== "pose") throw new Error("Expected Inventory remainder return.");
		expect(returned).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(samplePoseAnimation(returned, 1)).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		opener.container.x = 560;
		const animationCountBeforeContinuation = animations.length;
		returned.onComplete?.();

		const continuation = animations
			.slice(animationCountBeforeContinuation)
			.find(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:44:0",
			);
		if (continuation?.channel !== "pose") {
			throw new Error("Expected the retargeted Inventory remainder return.");
		}
		expect(continuation).toMatchObject({
			curve: {
				bounce: 0.22,
				kind: "spring",
			},
			delayMs: 0,
		});
		expect(samplePoseAnimation(continuation, 0)).toMatchObject({
			x: openerPose.x,
			y: openerPose.y,
		});
		expect(samplePoseAnimation(continuation, 1)).toMatchObject({
			x: opener.container.x,
			y: openerPose.y,
		});
		const animationCountBeforeVanish = animations.length;
		continuation.onComplete?.();

		expect(transient.container.destroyed).toBe(false);
		const vanishAnimations = animations.slice(animationCountBeforeVanish);
		const vanishPose = vanishAnimations.find(
			(animation) => animation.actor === transient && animation.channel === "pose",
		);
		if (vanishPose?.channel !== "pose") {
			throw new Error("Expected Inventory remainder scale-down.");
		}
		expect(vanishPose.durationMs).toBe(pixiTileActorRemovalFeedbackDurationMs);
		expect(vanishPose).toMatchObject({
			toScale: 0.72,
			toX: opener.container.x + transient.size * 0.14,
			toY: openerPose.y + transient.size * 0.14,
		});
		const vanishOpacity = vanishAnimations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (vanishOpacity?.channel !== "lifecycle-opacity") {
			throw new Error("Expected Inventory remainder fade-out.");
		}
		expect(vanishOpacity.durationMs).toBe(pixiTileActorRemovalFeedbackDurationMs);
		vanishOpacity.onCancel?.();

		expect(transient.container.destroyed).toBe(true);
		expect(completed).toHaveBeenCalledOnce();
		vanishOpacity.onComplete?.();
		expect(completed).toHaveBeenCalledOnce();
	});

	it("gates resolved owner output after the last input without returning a stale remainder", () => {
		const source = createActor("runtime:consumed-input-source");
		const owner = createActor("runtime:consumed-input-owner");
		const output = createActor("runtime:consumed-input-output");
		source.item = {
			...createItem(source.item.id, firstBoardLocation),
			quantity: 3,
		};
		owner.item = createItem(owner.item.id, secondBoardLocation);
		source.container.position.set(100, 40);
		source.container.alpha = 1;
		owner.container.position.set(200, 40);
		owner.container.alpha = 1;
		const actors = new Map([
			[
				source.item.id,
				source,
			],
			[
				owner.item.id,
				owner,
			],
			[
				output.item.id,
				output,
			],
		]);
		const canonicalItems = new Map([
			[
				output.item.id,
				output.item,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const transientActorLayer = new Container();
		const readPose = (location: TileActorItem["location"]) => ({
			layer: transientActorLayer,
			size: 80,
			x: location.position.x * 100,
			y: 40,
		});
		const runtime = Effect.runSync(
			createPixiTileMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
					destroyExitingActorFx: (actor: PixiTileActor) =>
						Effect.sync(() => {
							actor.container.destroy({
								children: true,
							});
						}),
					releaseActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application: {
					app: {
						canvas: {
							getBoundingClientRect: () => ({
								left: 0,
								top: 0,
							}),
						},
					},
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				magneticField: createRecordingMagneticField(),
				readPalette: () => ({}) as PixiScenePalette,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed(readPose(item.location)),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(readPose(location)),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		const cue = {
			canonicalItemId: source.item.itemId,
			eventIndex: 0,
			kind: "input",
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			previousQuantity: 3,
			storedQuantity: 2,
			resultingQuantity: 1,
			sequence: 41,
			sourceActorId: source.item.id,
			staggerIndex: 0,
			targetActorId: owner.item.id,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		const finalCue = {
			...cue,
			previousQuantity: 1,
			storedQuantity: 1,
			resultingQuantity: 0,
			sequence: 42,
		} satisfies TileMotionCue;
		const outputCue = {
			actorId: output.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: owner.item.id,
			originLocation: secondBoardLocation,
			sequence: 43,
			staggerIndex: 0,
			targetLocation: firstBoardLocation,
		} satisfies TileMotionCue;

		Effect.runSync(
			runtime.enqueueFx([
				cue,
				finalCue,
				outputCue,
			]),
		);
		Effect.runSync(runtime.startFx);

		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:41:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected the complete input travel.");
		const transient = travel.actor;
		expect(transient).toBe(source);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const removal = animations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (removal?.channel !== "lifecycle-opacity") {
			throw new Error("Expected the complete input contact fade.");
		}
		expect(
			animations.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:41:0",
			),
		).toHaveLength(1);
		expect(source.container.alpha).toBe(1);
		expect(
			animations.some(
				(animation) =>
					animation.actor === output &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:43:0",
			),
		).toBe(false);
		removal.onComplete?.();

		expect(actors.has(source.item.id)).toBe(false);
		expect(source.container.destroyed).toBe(true);
		expect(transient.container.destroyed).toBe(true);
		expect(
			animations.some(
				(animation) =>
					animation.actor === source &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 1,
			),
		).toBe(false);
		const outputTravel = animations.find(
			(animation) =>
				animation.actor === output &&
				animation.channel === "pose" &&
				animation.ownerKey === "motion:43:0",
		);
		if (outputTravel?.channel !== "pose") {
			throw new Error("Expected output to start after the last input settled.");
		}
		expect(actors.get(owner.item.id)).toBe(owner);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map([
				[
					output.item.id,
					"handoff",
				],
			]),
			retainedActorIds: new Set([
				output.item.id,
				owner.item.id,
			]),
		});

		samplePoseAnimation(outputTravel, 1);
		outputTravel.onComplete?.();

		expect(actors.has(owner.item.id)).toBe(false);
		expect(Effect.runSync(runtime.readSnapshotFx)).toMatchObject({
			interactionClaimByActorId: new Map(),
			retainedActorIds: new Set(),
		});
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: owner,
				channel: "lifecycle-opacity",
				durationMs: 220,
				toAlpha: 0,
			}),
		);
		Effect.runSync(runtime.closeFx);
	});

	it("uses one retained Inventory opener across a delivery batch and fades a spawn in", () => {
		const opener = createActor("runtime:inventory-origin");
		opener.container.position.set(150, 170);
		const spawned = createActor("runtime:spawned");
		const stacked = createActor("runtime:stacked");
		stacked.container.position.set(200, 40);
		const actors = new Map([
			[
				opener.item.id,
				opener,
			],
			[
				spawned.item.id,
				spawned,
			],
			[
				stacked.item.id,
				stacked,
			],
		]);
		const canonicalItems = new Map([
			[
				opener.item.id,
				opener.item,
			],
			[
				spawned.item.id,
				spawned.item,
			],
			[
				stacked.item.id,
				{
					...stacked.item,
					quantity: 2,
				},
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const magneticReleases: Array<{
			readonly sourceActorId: string;
			readonly sourceKind: "drag" | "motion";
		}> = [];
		const magneticUpdates: PixiTileMagneticFieldSample[] = [];
		const boardActorLayer = new Container();
		const transientActorLayer = new Container();
		let boardGeometry = {
			size: 80,
			stepX: 100,
			y: 40,
		};
		const readLocationPose = (
			location: typeof inventoryLocation | typeof firstBoardLocation,
		) =>
			location.scope === "inventory"
				? null
				: {
						layer: boardActorLayer,
						size: boardGeometry.size,
						x: location.position.x * boardGeometry.stepX,
						y: boardGeometry.y,
					};
		const runtime = Effect.runSync(
			createPixiTileMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application: {
					app: {
						canvas: {
							getBoundingClientRect: () => ({
								left: 10,
								top: 20,
							}),
						},
					},
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				magneticField: createRecordingMagneticField({
					releases: magneticReleases,
					updates: magneticUpdates,
				}),
				readPalette: () => ({}) as PixiScenePalette,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed(
							readLocationPose(
								item.location as
									| typeof inventoryLocation
									| typeof firstBoardLocation,
							),
						),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(
							readLocationPose(
								location as typeof inventoryLocation | typeof firstBoardLocation,
							),
						),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		const cues = [
			{
				actorId: spawned.item.id,
				eventIndex: 0,
				kind: "spawn",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				sequence: 7,
				staggerIndex: 0,
				targetLocation: firstBoardLocation,
			},
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 1,
				kind: "stack",
				originActorId: "runtime:inventory-origin",
				originLocation: inventoryLocation,
				quantity: 1,
				sequence: 7,
				staggerIndex: 1,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.has(stacked.item.id),
		).toBe(false);
		expect(animations).toHaveLength(4);
		expect(animations[0]).toMatchObject({
			actor: spawned,
			channel: "lifecycle-opacity",
			durationMs: 520,
			ownerKey: `actor-alpha:${spawned.instanceId}`,
			toAlpha: 1,
		});
		expect(animations[1]).toMatchObject({
			actor: spawned,
			channel: "pose",
			ownerKey: "motion:7:0",
		});
		expect(spawned.container.x).toBe(150);
		expect(spawned.container.y).toBe(170);

		const spawnTravel = readPoseAnimation(animations, spawned);
		const beforeResize = samplePoseAnimation(spawnTravel, 0.4);
		boardGeometry = {
			size: 120,
			stepX: 160,
			y: 90,
		};
		const resizeFrame = samplePoseAnimation(spawnTravel, 0.4);
		expect(resizeFrame).toEqual(beforeResize);
		const afterResize = samplePoseAnimation(spawnTravel, 0.7);
		expect(afterResize.x).toBeGreaterThan(resizeFrame.x);
		expect(afterResize.y).toBeLessThan(resizeFrame.y);
		const destination = samplePoseAnimation(spawnTravel, 1);
		expect(destination).toEqual({
			scale: 1.5,
			x: 160,
			y: 90,
		});
		spawnTravel.onComplete?.();
		expect(spawned.container).toMatchObject({
			x: destination.x,
			y: destination.y,
		});
		expect(spawned.container.alpha).toBe(0);

		const stackTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:7:1",
		);
		if (stackTravel?.channel !== "pose") {
			throw new Error("Expected stack payload travel.");
		}
		const stackTransient = stackTravel.actor;
		const stackBeforeTargetDrag = samplePoseAnimation(stackTravel, 0.8);
		stacked.dragging = true;
		const draggedStackSize = stacked.size;
		boardGeometry = {
			...boardGeometry,
			size: 160,
		};
		transientActorLayer.addChild(stacked.container);
		stacked.container.pivot.set(40);
		stacked.container.position.set(940, 440);
		const lateTargetMove = samplePoseAnimation(stackTravel, 0.95);
		expect(lateTargetMove.x).toBeGreaterThan(stackBeforeTargetDrag.x);
		expect(lateTargetMove.x).toBeLessThan(250);
		expect(lateTargetMove.y).toBeLessThan(stackBeforeTargetDrag.y);
		const firstEndpoint = samplePoseAnimation(stackTravel, 1);
		expect(firstEndpoint).toEqual({
			scale: 1.5,
			x: 900,
			y: 400,
		});
		stacked.container.position.set(1_240, 640);
		stackTravel.onComplete?.();
		expect(stacked.item.quantity).toBe(1);

		const finalContact = animations
			.filter(
				(animation) => animation.actor === stackTransient && animation.channel === "pose",
			)
			.at(-1);
		if (finalContact?.channel !== "pose") {
			throw new Error("Expected final live-target contact segment.");
		}
		expect(finalContact.durationMs).toBe(
			Effect.runSync(
				readPixiTileTravelDurationMsFx({
					fromX: 900,
					fromY: 400,
					tileSize: 120,
					toX: 1_200,
					toY: 600,
				}),
			),
		);
		expect(samplePoseAnimation(finalContact, 1)).toEqual({
			scale: 1.5,
			x: 1_200,
			y: 600,
		});
		// Magnetic feedback is child-local presentation only. It must not move the physical
		// contact anchor or recursively extend the stack chase.
		stacked.offsetLayer.position.set(6, -4);
		const animationCountBeforeContact = animations.length;
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === stackTransient.item.id),
		).toHaveLength(0);
		finalContact.onComplete?.();
		expect(animations.length).toBeGreaterThanOrEqual(animationCountBeforeContact + 3);
		completeStackMergeVanish({
			actor: stackTransient,
			animations,
		});
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.size).toBe(draggedStackSize);
		expect(stacked.container.parent).toBe(transientActorLayer);
		expect(stackTransient.container.destroyed).toBe(true);
		expect(magneticUpdates.length).toBeGreaterThan(0);
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: stacked.item.id,
			sourceActorId: stackTransient.item.id,
			sourceKind: "motion",
		});
		expect(
			magneticReleases.filter((release) => release.sourceActorId === stackTransient.item.id),
		).toEqual([
			{
				sourceActorId: stackTransient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		Effect.runSync(runtime.closeFx);
		expect(spawned.container.destroyed).toBe(false);
	});

	it("publishes sequential stack quantities and feedback only at each physical contact", () => {
		const stacked = createActor("runtime:sequential-stack");
		stacked.container.position.set(200, 40);
		const canonical = {
			...stacked.item,
			badgeCount: 3,
			quantity: 3,
		};
		const actors = new Map([
			[
				stacked.item.id,
				stacked,
			],
		]);
		const canonicalItems = new Map([
			[
				stacked.item.id,
				canonical,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const magneticReleases: Array<{
			readonly sourceActorId: string;
			readonly sourceKind: "drag" | "motion";
		}> = [];
		const transientActorLayer = new Container();
		const readPose = (location: TileActorItem["location"]) => ({
			layer: transientActorLayer,
			size: 80,
			x: location.position.x * 100,
			y: 40,
		});
		const runtime = Effect.runSync(
			createPixiTileMotionRuntimeFx({
				actorStore: {
					actors,
					canonicalItems,
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const actor = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return actor;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application: {
					app: {
						canvas: {
							getBoundingClientRect: () => ({
								left: 0,
								top: 0,
							}),
						},
					},
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				magneticField: createRecordingMagneticField({
					releases: magneticReleases,
				}),
				readPalette: () => ({}) as PixiScenePalette,
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readActorPoseFx: (item: TileActorItem) =>
						Effect.succeed(readPose(item.location)),
					readLocationPoseFx: (location: TileActorItem["location"]) =>
						Effect.succeed(readPose(location)),
					transientActorLayer,
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);
		const cues = [
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 0,
				kind: "stack",
				originActorId: "runtime:producer",
				originLocation: firstBoardLocation,
				quantity: 1,
				sequence: 20,
				staggerIndex: 0,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
			{
				canonicalItemId: stacked.item.itemId,
				eventIndex: 0,
				kind: "stack",
				originActorId: "runtime:producer",
				originLocation: firstBoardLocation,
				quantity: 1,
				sequence: 21,
				staggerIndex: 0,
				targetActorId: stacked.item.id,
				targetLocation: secondBoardLocation,
			},
		] satisfies TileMotionCue[];

		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.syncPresentationFx);
		Effect.runSync(runtime.startFx);

		expect(stacked.item.quantity).toBe(1);
		expect(stacked.item.badgeCount).toBeUndefined();
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		const firstTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:20:0",
		);
		if (firstTravel?.channel !== "pose") {
			throw new Error("Expected the first sequential stack payload.");
		}
		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:21:0",
			),
		).toBe(false);
		const firstTransient = firstTravel.actor;
		samplePoseAnimation(firstTravel, 1);
		expect(stacked.item.quantity).toBe(1);
		expect(stacked.item.badgeCount).toBeUndefined();
		firstTravel.onComplete?.();
		completeStackMergeVanish({
			actor: firstTransient,
			animations,
		});

		expect(firstTransient.container.destroyed).toBe(true);
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.item.badgeCount).toBe(2);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === firstTransient.item.id),
		).toHaveLength(1);
		const secondTravel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:21:0",
		);
		if (secondTravel?.channel !== "pose") {
			throw new Error("Expected the second sequential stack payload after first contact.");
		}
		const secondTransient = secondTravel.actor;
		samplePoseAnimation(secondTravel, 1);
		expect(stacked.item.quantity).toBe(2);
		expect(stacked.item.badgeCount).toBe(2);
		secondTravel.onComplete?.();
		completeStackMergeVanish({
			actor: secondTransient,
			animations,
		});

		expect(secondTransient.container.destroyed).toBe(true);
		expect(stacked.item.quantity).toBe(3);
		expect(stacked.item.badgeCount).toBe(3);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === stacked && animation.channel === "activity-particles",
			),
		).toHaveLength(2);
		expect(
			magneticReleases.filter((release) => release.sourceActorId === secondTransient.item.id),
		).toHaveLength(1);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);
		Effect.runSync(runtime.closeFx);
	});

	it("follows a consumed held target into its redirected sink before vanishing", () => {
		const {
			actors,
			animations,
			canonicalItems,
			cue,
			magneticReleases,
			magneticUpdates,
			runtime,
			target,
		} = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		const inventory = createActor("runtime:inventory");
		inventory.item = createItem(inventory.item.id, inventoryLocation);
		inventory.container.position.set(640, 320);
		actors.set(inventory.item.id, inventory);
		canonicalItems.set(inventory.item.id, inventory.item);

		samplePoseAnimation(travel, 0.4);
		Effect.runSync(
			runtime.redirectTargetFx({
				sourceActorId: target.item.id,
				targetActorId: inventory.item.id,
				targetLocation: inventory.item.location,
			}),
		);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map([
				[
					inventory.item.id,
					{
						kind: "subtract",
						quantity: 1,
					},
				],
			]),
		);
		canonicalItems.delete(target.item.id);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const redirectedTravel = animations
			.filter(
				(animation) =>
					animation.actor === transient &&
					animation.channel === "pose" &&
					animation.ownerKey === "motion:30:0",
			)
			.at(-1);
		if (redirectedTravel?.channel !== "pose" || redirectedTravel === travel) {
			throw new Error("Expected redirected sink chase.");
		}
		expect(samplePoseAnimation(redirectedTravel, 1)).toEqual({
			scale: 1,
			x: 640,
			y: 320,
		});
		redirectedTravel.onComplete?.();

		expect(magneticUpdates.length).toBeGreaterThan(0);
		expect(magneticUpdates.at(-1)).toMatchObject({
			attractedActorId: inventory.item.id,
			eligibleAttractionActorIds: new Set([
				inventory.item.id,
			]),
		});
		expect(magneticReleases).toEqual([]);
		expect(transient.container.destroyed).toBe(false);
		expect(destroy).not.toHaveBeenCalled();
		const vanishOpacity = animations.find(
			(animation) =>
				animation.actor === transient &&
				animation.channel === "lifecycle-opacity" &&
				animation.toAlpha === 0,
		);
		if (vanishOpacity?.channel !== "lifecycle-opacity") {
			throw new Error("Expected redirected payload fade-out.");
		}
		expect(vanishOpacity.durationMs).toBe(pixiTileActorRemovalFeedbackDurationMs);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId.size).toBe(1);
		vanishOpacity.onComplete?.();

		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: transient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toHaveLength(1);
	});

	it("retargets a replacement stack actor and publishes contact only on the surviving instance", () => {
		const { actors, animations, cue, magneticReleases, runtime, target } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		const replacement = createActor(target.item.id);
		replacement.item = createItem(replacement.item.id, secondBoardLocation);
		replacement.container.position.set(480, 140);

		samplePoseAnimation(travel, 0.6);
		actors.set(target.item.id, replacement);
		samplePoseAnimation(travel, 1);
		travel.onComplete?.();
		const contact = animations
			.filter((animation) => animation.actor === transient && animation.channel === "pose")
			.at(-1);
		if (contact?.channel !== "pose") throw new Error("Expected a replacement chase segment.");
		expect(contact).not.toBe(travel);
		expect(samplePoseAnimation(contact, 1)).toEqual({
			scale: 1,
			x: 480,
			y: 140,
		});
		contact.onComplete?.();
		completeStackMergeVanish({
			actor: transient,
			animations,
		});

		expect(target.item.quantity).toBe(1);
		expect(replacement.item.quantity).toBe(2);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === target && animation.channel === "activity-particles",
			),
		).toHaveLength(0);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === replacement && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
		expect(magneticReleases).toEqual([
			{
				sourceActorId: transient.item.id,
				sourceKind: "motion",
			},
		]);
		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();

		Effect.runSync(runtime.closeFx);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticReleases).toHaveLength(1);
	});

	it.each([
		{
			acquired: false,
			label: "before",
		},
		{
			acquired: true,
			label: "after",
		},
	])("closes a stack payload exactly once $label its first magnetic projection", ({
		acquired,
	}) => {
		const { animations, canceledOwnerKeys, cue, magneticReleases, magneticUpdates, runtime } =
			createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		if (acquired) samplePoseAnimation(travel, 0.2);

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);

		expect(canceledOwnerKeys).toContain("motion:30:0");
		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();
		expect(magneticUpdates.length > 0).toBe(acquired);
		expect(magneticReleases).toEqual(
			acquired
				? [
						{
							sourceActorId: transient.item.id,
							sourceKind: "motion",
						},
					]
				: [],
		);
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);
	});

	it("supersedes an unfinished spawn fade when the actor disappears at settlement", () => {
		const actor = createActor("runtime:short-lived-spawn");
		actor.container.alpha = 0.37;
		const actors = new Map([
			[
				actor.item.id,
				actor,
			],
		]);
		const animations: PixiActorAnimation[] = [];
		const exitingActors = new Set<PixiTileActor>();

		Effect.runSync(
			finalizePixiTileMotionActorsFx({
				actorIds: new Set([
					actor.item.id,
				]),
				actorStore: {
					actors,
					canonicalItems: new Map(),
					deleteActorFx: (actorId: string) =>
						Effect.sync(() => {
							const deleted = actors.get(actorId) ?? null;
							actors.delete(actorId);
							return deleted;
						}),
					destroyExitingActorFx: (exitingActor: PixiTileActor) =>
						Effect.sync(() => {
							exitingActors.delete(exitingActor);
							exitingActor.container.destroy({
								children: true,
							});
						}),
					releaseActorFx: (actorId: string) =>
						Effect.sync(() => {
							const released = actors.get(actorId) ?? null;
							actors.delete(actorId);
							if (released !== null) exitingActors.add(released);
							return released;
						}),
				} as unknown as PixiMainSceneActorStore,
				animator: createRecordingAnimator({
					animations,
				}),
				application: {
					frames: {
						invalidateFx: Effect.void,
					},
				} as unknown as PixiApplicationOwner,
				readPalette: () => ({}) as PixiScenePalette,
				stillClaimedActorIds: new Set(),
				surface: {
					readLocalActorIdsFx: () => Effect.succeed([]),
					readActorPoseFx: () => Effect.succeed(null),
				} as unknown as PixiMainSceneSurface,
				textures: {} as never,
			}),
		);

		expect(actors.has(actor.item.id)).toBe(false);
		expect(actor.container.alpha).toBe(0.37);
		expect(animations).toEqual([
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: 220,
				ownerKey: `actor-alpha:${actor.instanceId}`,
				toAlpha: 0,
			}),
		]);
		expect(actor.container.destroyed).toBe(false);
		animations[0]?.onComplete?.();
		expect(actor.container.destroyed).toBe(true);
	});

	it("animates both swap legs from their live poses and releases claims together", () => {
		const { animations, cue, magneticReleases, magneticUpdates, runtime, source, target } =
			createSwapHarness();

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(2);
		expect(animations.find((animation) => animation.actor === target)).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
			ownerKey: `motion:9:0:${target.item.id}`,
		});
		expect(animations.find((animation) => animation.actor === source)).toMatchObject({
			channel: "pose",
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
			ownerKey: `motion:9:0:${source.item.id}`,
		});
		expect(animations.every(({ durationMs }) => durationMs < 280)).toBe(true);
		expect(source.container.x).toBe(245);
		expect(source.container.y).toBe(47);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					target.item.id,
					"handoff",
				],
				[
					source.item.id,
					"handoff",
				],
			]),
		);

		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(targetTravel, 1);
		samplePoseAnimation(sourceTravel, 1);
		expect(magneticUpdates).toHaveLength(2);
		expect(magneticUpdates[0]).toMatchObject({
			attractedActorId: null,
			sourceActorId: target.item.id,
			sourceDirection: {
				x: -1,
				y: 0,
			},
			sourceKind: "motion",
		});
		expect(Array.from(magneticUpdates[0]?.eligibleAttractionActorIds ?? [])).toEqual([
			source.item.id,
		]);
		expect(magneticUpdates[1]).toMatchObject({
			attractedActorId: null,
			sourceActorId: source.item.id,
			sourceKind: "motion",
		});
		expect(magneticUpdates[1]?.sourceDirection?.x).toBeCloseTo(-0.9881);
		expect(magneticUpdates[1]?.sourceDirection?.y).toBeCloseTo(-0.1537);
		expect(Array.from(magneticUpdates[1]?.eligibleAttractionActorIds ?? [])).toEqual([
			target.item.id,
		]);
		targetTravel.onComplete?.();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		sourceTravel.onComplete?.();

		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
			{
				sourceActorId: source.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container.x).toBe(100);
		expect(source.container.x).toBe(200);
	});

	it("hands one live swap leg to direct interaction without canceling its counterpart", () => {
		const {
			animations,
			canceledAnimationKeys,
			cue,
			magneticReleases,
			runtime,
			source,
			target,
		} = createSwapHarness();
		const pendingCue = {
			...cue,
			eventIndex: 1,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				pendingCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		const liveTargetPose = samplePoseAnimation(targetTravel, 0.4);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);

		expect(canceledAnimationKeys).toContain(`motion:9:0:${target.item.id}`);
		expect(canceledAnimationKeys).not.toContain(`motion:9:0:${source.item.id}`);
		expect(magneticReleases).toContainEqual({
			sourceActorId: target.item.id,
			sourceKind: "motion",
		});
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					source.item.id,
					"handoff",
				],
			]),
		);
		expect(animations).toHaveLength(2);
		expect(target.container).toMatchObject({
			x: liveTargetPose.x,
			y: liveTargetPose.y,
		});

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onComplete?.();
		expect(magneticReleases).toContainEqual({
			sourceActorId: source.item.id,
			sourceKind: "motion",
		});
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container).toMatchObject({
			x: liveTargetPose.x,
			y: liveTargetPose.y,
		});
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(false);
	});

	it("hands both swap legs over independently without leaving a stale magnetic source", () => {
		const {
			animations,
			canceledAnimationKeys,
			cue,
			magneticReleases,
			runtime,
			source,
			target,
		} = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.4);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(
			new Map([
				[
					source.item.id,
					"handoff",
				],
			]),
		);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(source.item.id))).toBe(true);

		expect(canceledAnimationKeys).toEqual(
			expect.arrayContaining([
				`motion:9:0:${target.item.id}`,
				`motion:9:0:${source.item.id}`,
			]),
		);
		expect(magneticReleases).toEqual(
			expect.arrayContaining([
				{
					sourceActorId: target.item.id,
					sourceKind: "motion",
				},
				{
					sourceActorId: source.item.id,
					sourceKind: "motion",
				},
			]),
		);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		const releaseCount = magneticReleases.length;
		Effect.runSync(runtime.closeFx);
		expect(magneticReleases).toHaveLength(releaseCount);
	});

	it("releases a detached swap counterpart when the motion runtime closes", () => {
		const { animations, cue, magneticReleases, runtime, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.35);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.35);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(source.item.id),
		).toBe("handoff");
		Effect.runSync(runtime.closeFx);

		expect(magneticReleases).toEqual(
			expect.arrayContaining([
				{
					sourceActorId: target.item.id,
					sourceKind: "motion",
				},
				{
					sourceActorId: source.item.id,
					sourceKind: "motion",
				},
			]),
		);
	});

	it("keeps pending work parked when an independent cue completes during detached swap ownership", () => {
		const { actors, animations, canonicalItems, cue, runtime, source, target } =
			createSwapHarness();
		const independent = createActor("runtime:independent-spawn");
		independent.item = createItem(independent.item.id, firstBoardLocation);
		actors.set(independent.item.id, independent);
		canonicalItems.set(independent.item.id, independent.item);
		const independentCue = {
			actorId: independent.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: "runtime:independent-origin",
			originLocation: secondBoardLocation,
			sequence: 10,
			staggerIndex: 0,
			targetLocation: firstBoardLocation,
		} satisfies TileMotionCue;
		const pendingDetachedCue = {
			actorId: source.item.id,
			eventIndex: 0,
			kind: "spawn",
			originActorId: "runtime:pending-origin",
			originLocation: firstBoardLocation,
			sequence: 12,
			staggerIndex: 0,
			targetLocation: secondBoardLocation,
		} satisfies TileMotionCue;
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				independentCue,
				pendingDetachedCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(4);
		const sourceTravel = readPoseAnimation(animations, source);
		const independentTravel = readPoseAnimation(animations, independent);

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		samplePoseAnimation(independentTravel, 1);
		independentTravel.onComplete?.();

		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:12:0",
			),
		).toBe(false);
		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(source.item.id),
		).toBe("handoff");

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onComplete?.();

		expect(
			animations.some(
				(animation) => animation.channel === "pose" && animation.ownerKey === "motion:12:0",
			),
		).toBe(true);
	});

	it("finalizes a detached swap counterpart that loses its canonical item before settlement", () => {
		const { actors, animations, canonicalItems, cue, exitingActors, runtime, source, target } =
			createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(sourceTravel, 0.4);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		canonicalItems.delete(source.item.id);

		samplePoseAnimation(sourceTravel, 1);
		sourceTravel.onComplete?.();

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.has(source.item.id),
		).toBe(false);
		expect(actors.has(source.item.id)).toBe(false);
		expect(exitingActors.has(source)).toBe(true);
		expect(animations).toContainEqual(
			expect.objectContaining({
				actor: source,
				channel: "lifecycle-opacity",
				toAlpha: 0,
			}),
		);
	});

	it("finalizes an already-settled counterpart when the other swap leg is handed off", () => {
		const { actors, animations, canonicalItems, cue, exitingActors, runtime, source, target } =
			createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const sourceTravel = readPoseAnimation(animations, source);
		samplePoseAnimation(sourceTravel, 1);
		canonicalItems.delete(source.item.id);
		sourceTravel.onComplete?.();

		expect(actors.has(source.item.id)).toBe(true);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(target.item.id))).toBe(true);
		expect(actors.has(source.item.id)).toBe(false);
		expect(exitingActors.has(source)).toBe(true);
	});

	it("hands an active spawn to direct interaction at its exact live pose", () => {
		const {
			animations,
			canceledAnimationKeys,
			magneticReleases,
			magneticUpdates,
			runtime,
			spawnCue,
			spawned,
		} = createSpawnHarness();
		Effect.runSync(
			runtime.enqueueFx([
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const spawnTravel = readPoseAnimation(animations, spawned);
		const livePose = samplePoseAnimation(spawnTravel, 0.43);
		const fadeGeneration = spawned.lifecycleIntentGeneration;

		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(true);

		expect(canceledAnimationKeys).toContain("motion:11:0");
		expect(magneticUpdates).toHaveLength(1);
		expect(magneticUpdates[0]).toMatchObject({
			attractedActorId: null,
			sourceActorId: spawned.item.id,
			sourceDirection: {
				x: -1,
				y: 0,
			},
			sourceKind: "motion",
		});
		expect(magneticUpdates[0]?.eligibleAttractionActorIds.size).toBe(0);
		expect(magneticReleases).toEqual([
			{
				sourceActorId: spawned.item.id,
				sourceKind: "motion",
			},
		]);
		expect(animations).toHaveLength(2);
		expect(spawned.lifecycleIntentGeneration).toBe(fadeGeneration);
		expect(spawned.container).toMatchObject({
			x: livePose.x,
			y: livePose.y,
		});
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.interactionClaimByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.spawnCueByActorId.has(spawned.item.id)).toBe(false);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(false);
	});

	it("releases a spawned magnetic source on natural settlement", () => {
		const { animations, magneticReleases, runtime, spawnCue, spawned } = createSpawnHarness();
		Effect.runSync(
			runtime.enqueueFx([
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const spawnTravel = readPoseAnimation(animations, spawned);
		samplePoseAnimation(spawnTravel, 1);
		spawnTravel.onComplete?.();

		expect(magneticReleases).toEqual([
			{
				sourceActorId: spawned.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});

	it("starts the durable fade when a pending spawn is handed directly to interaction", () => {
		const {
			animations,
			blocker,
			blockerCue,
			canceledAnimationKeys,
			runtime,
			spawnCue,
			spawned,
		} = createSpawnHarness();
		const pendingPose = {
			x: spawned.container.x,
			y: spawned.container.y,
		};
		Effect.runSync(
			runtime.enqueueFx([
				blockerCue,
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(2);
		expect(Effect.runSync(runtime.readSnapshotFx).spawnCueByActorId.has(spawned.item.id)).toBe(
			true,
		);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(spawned.item.id))).toBe(true);

		expect(canceledAnimationKeys).not.toContain("motion:11:0");
		expect(spawned.container).toMatchObject(pendingPose);
		expect(spawned.lifecycleIntentGeneration).toBe(1);
		expect(spawned.lifecycleTargetAlpha).toBe(1);
		expect(spawned.lifecycleFadeStarted).toBe(true);
		expect(animations).toHaveLength(3);
		expect(animations[2]).toMatchObject({
			actor: spawned,
			channel: "lifecycle-opacity",
			durationMs: 520,
			ownerKey: `actor-alpha:${spawned.instanceId}`,
			toAlpha: 1,
		});
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.spawnCueByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.interactionClaimByActorId.has(spawned.item.id)).toBe(false);
		expect(snapshot.interactionClaimByActorId.get(blocker.item.id)).toBe("handoff");

		const blockerTravel = readPoseAnimation(animations, blocker);
		blockerTravel.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});

	it("animates and completes the available swap leg when its counterpart actor is missing", () => {
		const { animations, cue, magneticReleases, runtime, target } = createSwapHarness({
			includeSource: false,
		});

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		expect(animations).toHaveLength(1);
		expect(animations[0]?.actor).toBe(target);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.5);
		target.container.destroyed = true;
		animations[0]?.onComplete?.();
		expect(magneticReleases).toEqual([
			{
				sourceActorId: target.item.id,
				sourceKind: "motion",
			},
		]);
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
	});

	it("retargets both swap legs continuously when live surface geometry changes", () => {
		const { animations, cue, runtime, setGeometry, source, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const targetTravel = readPoseAnimation(animations, target);
		const sourceTravel = readPoseAnimation(animations, source);
		expect(samplePoseAnimation(sourceTravel, 0)).toEqual({
			scale: 1,
			x: 245,
			y: 47,
		});
		const targetBeforeResize = samplePoseAnimation(targetTravel, 0.4);
		const sourceBeforeResize = samplePoseAnimation(sourceTravel, 0.4);

		setGeometry({
			size: 120,
			stepX: 200,
			y: 80,
		});
		expect(samplePoseAnimation(targetTravel, 0.4)).toEqual(targetBeforeResize);
		expect(samplePoseAnimation(sourceTravel, 0.4)).toEqual(sourceBeforeResize);

		const targetAfterResize = samplePoseAnimation(targetTravel, 0.7);
		const sourceAfterResize = samplePoseAnimation(sourceTravel, 0.7);
		expect(targetAfterResize).toEqual({
			scale: 1.25,
			x: 180,
			y: 60,
		});
		expect(sourceAfterResize).toMatchObject({
			scale: 1.25,
			x: 313.5,
		});
		expect(sourceAfterResize.y).toBeCloseTo(62.1);

		setGeometry({
			size: 140,
			stepX: 260,
			y: 100,
		});
		const targetDuringSecondResize = samplePoseAnimation(targetTravel, 0.8);
		const sourceDuringSecondResize = samplePoseAnimation(sourceTravel, 0.8);
		expect(targetDuringSecondResize.x).toBeGreaterThan(targetAfterResize.x);
		expect(sourceDuringSecondResize.x).toBeGreaterThan(sourceAfterResize.x);
		expect(samplePoseAnimation(targetTravel, 0.8)).toEqual(targetDuringSecondResize);
		expect(samplePoseAnimation(sourceTravel, 0.8)).toEqual(sourceDuringSecondResize);

		setGeometry({
			size: 160,
			stepX: 320,
			y: 120,
		});
		const targetDuringThirdResize = samplePoseAnimation(targetTravel, 0.9);
		const sourceDuringThirdResize = samplePoseAnimation(sourceTravel, 0.9);
		expect(targetDuringThirdResize.x).toBeGreaterThan(targetDuringSecondResize.x);
		expect(sourceDuringThirdResize.x).toBeGreaterThan(sourceDuringSecondResize.x);

		setGeometry({
			size: 200,
			stepX: 500,
			y: 200,
		});
		const targetDestination = samplePoseAnimation(targetTravel, 1);
		const sourceDestination = samplePoseAnimation(sourceTravel, 1);
		// An exact-final-frame resize preserves the previous path endpoint without teleporting.
		expect(targetDestination).toEqual({
			scale: 2,
			x: 320,
			y: 120,
		});
		expect(sourceDestination).toEqual({
			scale: 2,
			x: 640,
			y: 120,
		});
		targetTravel.onComplete?.();
		sourceTravel.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);

		const targetSettle = animations
			.filter((animation) => animation.actor === target && animation.channel === "pose")
			.at(-1);
		const sourceSettle = animations
			.filter((animation) => animation.actor === source && animation.channel === "pose")
			.at(-1);
		if (targetSettle?.channel !== "pose" || sourceSettle?.channel !== "pose") {
			throw new Error("Expected final-frame semantic settle animations.");
		}
		expect(samplePoseAnimation(targetSettle, 0)).toEqual(targetDestination);
		expect(samplePoseAnimation(sourceSettle, 0)).toEqual(sourceDestination);
		samplePoseAnimation(targetSettle, 0.9);
		samplePoseAnimation(sourceSettle, 0.9);
		setGeometry({
			size: 240,
			stepX: 700,
			y: 240,
		});
		const firstSettleDestination = samplePoseAnimation(targetSettle, 1);
		const firstSourceSettleDestination = samplePoseAnimation(sourceSettle, 1);
		expect(firstSettleDestination).toEqual({
			scale: 2.5,
			x: 500,
			y: 200,
		});
		expect(firstSourceSettleDestination).toEqual({
			scale: 2.5,
			x: 1_000,
			y: 200,
		});
		targetSettle.onComplete?.();
		sourceSettle.onComplete?.();
		const finalTargetSettle = animations
			.filter((animation) => animation.actor === target && animation.channel === "pose")
			.at(-1);
		const finalSourceSettle = animations
			.filter((animation) => animation.actor === source && animation.channel === "pose")
			.at(-1);
		if (finalTargetSettle?.channel !== "pose" || finalSourceSettle?.channel !== "pose") {
			throw new Error("Expected recursive final-frame semantic settles.");
		}
		expect(samplePoseAnimation(finalTargetSettle, 0)).toEqual(firstSettleDestination);
		expect(samplePoseAnimation(finalSourceSettle, 0)).toEqual(firstSourceSettleDestination);
		const latestTargetDestination = samplePoseAnimation(finalTargetSettle, 1);
		const latestSourceDestination = samplePoseAnimation(finalSourceSettle, 1);
		expect(latestTargetDestination).toEqual({
			scale: 3,
			x: 700,
			y: 240,
		});
		expect(latestSourceDestination).toEqual({
			scale: 3,
			x: 1_400,
			y: 240,
		});
		finalTargetSettle.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		finalSourceSettle.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(target.container).toMatchObject({
			x: latestTargetDestination.x,
			y: latestTargetDestination.y,
		});
		expect(source.container).toMatchObject({
			x: latestSourceDestination.x,
			y: latestSourceDestination.y,
		});
	});

	it("deduplicates completed cues and ignores duplicate leg completion", () => {
		const { animations, cue, runtime } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);

		animations[0]?.onComplete?.();
		animations[0]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(2);
		animations[1]?.onComplete?.();
		animations[1]?.onComplete?.();
		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.size).toBe(0);

		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(2);
	});

	it("keeps overlapping spawn and swap ownership explicitly handoff-capable", () => {
		const { cue, runtime, target } = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				{
					actorId: target.item.id,
					eventIndex: 1,
					kind: "spawn",
					originActorId: target.item.id,
					originLocation: secondBoardLocation,
					sequence: cue.sequence,
					staggerIndex: 0,
					targetLocation: firstBoardLocation,
				},
			]),
		);

		expect(
			Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId.get(target.item.id),
		).toBe("handoff");
	});

	it("clears claims on close and ignores late swap completion callbacks", () => {
		const {
			animations,
			canceledAnimationKeys,
			cue,
			magneticReleases,
			runtime,
			source,
			target,
		} = createSwapHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, target), 0.4);
		samplePoseAnimation(readPoseAnimation(animations, source), 0.4);

		Effect.runSync(runtime.closeFx);
		for (const animation of animations) animation.onComplete?.();

		expect(Effect.runSync(runtime.readSnapshotFx).interactionClaimByActorId).toEqual(new Map());
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.actorId}`);
		expect(canceledAnimationKeys).toContain(`motion:9:0:${cue.counterpartActorId}`);
		expect(magneticReleases).toEqual(
			expect.arrayContaining([
				{
					sourceActorId: target.item.id,
					sourceKind: "motion",
				},
				{
					sourceActorId: source.item.id,
					sourceKind: "motion",
				},
			]),
		);
		expect(animations).toHaveLength(2);
	});
});
