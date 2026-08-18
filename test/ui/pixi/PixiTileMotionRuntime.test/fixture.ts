// @vitest-environment jsdom

import { Effect } from "effect";
import {
	Container,
	Graphics,
	Particle,
	ParticleContainer,
	Sprite,
	Text,
	TextStyle,
	Texture,
} from "pixi.js";
import { vi } from "vitest";

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
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type {
	PixiTileMagneticField,
	PixiTileMagneticFieldSample,
} from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createPixiTileMotionRuntimeFx } from "~/ui/pixi/motion/createPixiTileMotionRuntimeFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

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

export const inventoryLocation = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};
export const firstBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};
export const secondBoardLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};

export const testPalette = {
	accent: 0,
	danger: 0,
	foreground: 0,
	gridA: 0,
	gridB: 0,
	line: 0,
	overlay: 0,
	overlayForeground: 0,
	success: 0,
	surface: 0,
	toolbarA: 0,
	toolbarB: 0,
} satisfies PixiScenePalette;

export const createItem = (
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

export const createActor = (id: string): PixiTileActor => {
	const item = createItem(id);
	const container = new Container();
	container.alpha = 0;
	const titleStyle = new TextStyle();
	const visual = {
		container: new Container(),
		primary: new Sprite(Texture.EMPTY),
		composite: new Sprite(Texture.EMPTY),
		title: new Text({
			style: titleStyle,
			text: item.title,
		}),
		titleBackground: new Graphics(),
		quantity: new Text({
			text: String(item.quantity),
		}),
		quantityBackground: new Graphics(),
		titleStyle,
		item,
		readyListeners: new Set(),
		reportCriticalFailure: () => {},
		size: 80,
		textureGeneration: 0,
		textureState: "ready",
	} satisfies PixiTileActorVisual;
	const particle = new Particle(Texture.EMPTY);
	const activityParticleContainer = new ParticleContainer({
		particles: [
			particle,
		],
		texture: Texture.EMPTY,
	});
	return {
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
		progressBar: new Graphics(),
		size: 80,
		visualLayer: new Container(),
		visuals: new Set([
			visual,
		]),
		visualTransitionGeneration: 0,
	} satisfies PixiTileActor;
};

export const createActorMap = (...actors: ReadonlyArray<PixiTileActor>) =>
	new Map(
		actors.map(
			(actor) =>
				[
					actor.item.id,
					actor,
				] as const,
		),
	);

export const createItemMap = (...items: ReadonlyArray<TileActorItem>) =>
	new Map(
		items.map(
			(item) =>
				[
					item.id,
					item,
				] as const,
		),
	);

export const createActorStore = ({
	actors = new Map<string, PixiTileActor>(),
	canonicalItems = new Map<string, TileActorItem>(),
	exitingActors = new Set<PixiTileActor>(),
}: {
	readonly actors?: Map<string, PixiTileActor>;
	readonly canonicalItems?: Map<string, TileActorItem>;
	readonly exitingActors?: Set<PixiTileActor>;
} = {}): PixiMainSceneActorStore => ({
	actors,
	canonicalItems,
	closeFx: Effect.void,
	deleteActorFx: (actorId) =>
		Effect.sync(() => {
			const actor = actors.get(actorId) ?? null;
			actors.delete(actorId);
			return actor;
		}),
	destroyExitingActorFx: (actor) =>
		Effect.sync(() => {
			exitingActors.delete(actor);
			actor.container.destroy({
				children: true,
			});
		}),
	readActorFx: (actorId) => Effect.sync(() => actors.get(actorId) ?? null),
	readCanonicalItemFx: (actorId) => Effect.sync(() => canonicalItems.get(actorId) ?? null),
	readCanonicalOccupantFx: () => Effect.succeed(null),
	readCanonicalOccupantsFx: () => Effect.succeed([]),
	releaseActorFx: (actorId) =>
		Effect.sync(() => {
			const actor = actors.get(actorId) ?? null;
			actors.delete(actorId);
			if (actor !== null) exitingActors.add(actor);
			return actor;
		}),
	replaceCanonicalItemsFx: (items) =>
		Effect.sync(() => {
			canonicalItems.clear();
			for (const item of items) canonicalItems.set(item.id, item);
		}),
	setActorFx: (actor) =>
		Effect.sync(() => {
			actors.set(actor.item.id, actor);
		}),
});

export const createApplication = (
	boundingRect: { readonly left: number; readonly top: number } = {
		left: 0,
		top: 0,
	},
): PixiApplicationOwner => ({
	addResizeListenerFx: () => Effect.succeed(() => {}),
	app: {
		canvas: {
			getBoundingClientRect: () => boundingRect,
		},
	} as PixiApplicationOwner["app"],
	closeFx: Effect.void,
	frames: {
		closeFx: Effect.void,
		invalidateFx: Effect.void,
		reportCriticalFailure: () => {},
		scheduleFx: () => Effect.succeed(() => {}),
	},
	stage: new Container(),
});

export const createSurface = ({
	readActorPose,
	readLocationPose = () => null,
	transientActorLayer = new Container(),
}: {
	readonly readActorPose?: (item: TileActorItem) => PixiTileActorPose | null;
	readonly readLocationPose?: (location: TileActorItem["location"]) => PixiTileActorPose | null;
	readonly transientActorLayer?: Container;
} = {}): PixiMainSceneSurface => ({
	closeFx: Effect.void,
	readActorPoseFx: (item) =>
		Effect.succeed(readActorPose?.(item) ?? readLocationPose(item.location)),
	readLocalActorIdsFx: () => Effect.succeed([]),
	readLocationPoseFx: (location) => Effect.succeed(readLocationPose(location)),
	readTargetFactsFx: () =>
		Effect.succeed({
			commandTarget: {
				kind: "unsupported",
			},
			occupant: null,
			stableKey: "test:unsupported",
			target: null,
		}),
	redrawFx: Effect.void,
	renderDropFeedbackFx: () => Effect.void,
	setPaletteFx: () => Effect.void,
	setTransitionFx: () => Effect.void,
	transientActorLayer,
});

export const applyPresentationWrite = (write: PixiActorPresentationWrite) => {
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

export const createRecordingAnimator = ({
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

export const createRecordingMagneticField = ({
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

export const readPoseAnimation = (
	animations: ReadonlyArray<PixiActorAnimation>,
	actor: PixiTileActor,
) => {
	const animation = animations.find(
		(candidate) => candidate.actor === actor && candidate.channel === "pose",
	);
	if (animation?.channel !== "pose") throw new Error("Expected a pose animation.");
	return animation;
};

export const samplePoseAnimation = (
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

export const advanceInputRemainderFlash = ({
	actor,
	animations,
	cancelFadeIn = false,
	cueKey,
}: {
	readonly actor: PixiTileActor;
	readonly animations: ReadonlyArray<PixiActorAnimation>;
	readonly cancelFadeIn?: boolean;
	readonly cueKey: string;
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
	const quantityBeforeFadeOut = actor.item.quantity;
	fadeOut.onComplete?.();
	const badgeCountAfterFadeOut = actor.item.badgeCount;
	const quantityAfterFadeOut = actor.item.quantity;

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
	(cancelFadeIn ? fadeIn.onCancel : fadeIn.onComplete)?.();
	return {
		badgeCountAfterFadeOut,
		fadeIn,
		fadeOut,
		quantityAfterFadeIn: actor.item.quantity,
		quantityAfterFadeOut,
		quantityBeforeFadeOut,
	};
};

export const advanceStackMergeVanish = ({
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
	const scaleBeforeVanish = actor.container.scale.x;
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
	vanishOpacity.onComplete?.();
	return {
		scaleBeforeVanish,
		vanishOpacity,
		vanishPose,
	};
};

export const createMotionHarness = ({
	actors = new Map<string, PixiTileActor>(),
	boundingRect = {
		left: 0,
		top: 0,
	},
	canonicalItems = new Map<string, TileActorItem>(),
	readPose,
	transientActorLayer = new Container(),
}: {
	readonly actors?: Map<string, PixiTileActor>;
	readonly boundingRect?: {
		readonly left: number;
		readonly top: number;
	};
	readonly canonicalItems?: Map<string, TileActorItem>;
	readonly readPose?: (location: TileActorItem["location"]) => PixiTileActorPose | null;
	readonly transientActorLayer?: Container;
} = {}) => {
	const actorLayer = new Container();
	const animations: PixiActorAnimation[] = [];
	const canceledOwnerKeys: string[] = [];
	const exitingActors = new Set<PixiTileActor>();
	const magneticReleases: Array<{
		readonly sourceActorId: string;
		readonly sourceKind: "drag" | "motion";
	}> = [];
	const magneticUpdates: PixiTileMagneticFieldSample[] = [];
	const resolvePose =
		readPose ??
		((location: TileActorItem["location"]) => ({
			layer: actorLayer,
			size: 80,
			x: location.position.x * 100,
			y: 40,
		}));
	const actorStore = createActorStore({
		actors,
		canonicalItems,
		exitingActors,
	});
	const animator = createRecordingAnimator({
		animations,
		canceledOwnerKeys,
	});
	const application = createApplication(boundingRect);
	const surface = createSurface({
		readLocationPose: resolvePose,
		transientActorLayer,
	});
	const magneticField = createRecordingMagneticField({
		releases: magneticReleases,
		updates: magneticUpdates,
	});
	const runtime = Effect.runSync(
		createPixiTileMotionRuntimeFx({
			actorStore,
			animator,
			application,
			magneticField,
			readPalette: () => testPalette,
			surface,
			textures: {} as never,
		}),
	);

	return {
		actorLayer,
		actorStore,
		animations,
		animator,
		application,
		canceledOwnerKeys,
		exitingActors,
		magneticField,
		magneticReleases,
		magneticUpdates,
		runtime,
		surface,
		transientActorLayer,
	};
};

export const createSwapHarness = ({
	includeSource = true,
	includeTarget = true,
}: {
	readonly includeSource?: boolean;
	readonly includeTarget?: boolean;
} = {}) => {
	const source = createActor("runtime:source");
	const target = createActor("runtime:target");
	source.container.position.set(245, 47);
	target.container.position.set(200, 40);
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
		] as const,
		[
			target.item.id,
			target.item,
		] as const,
	]);
	let geometry = {
		size: 80,
		stepX: 100,
		y: 40,
	};
	const transientActorLayer = new Container();
	const harness = createMotionHarness({
		actors,
		canonicalItems,
		readPose: (location) => ({
			layer: transientActorLayer,
			size: geometry.size,
			x: location.position.x * geometry.stepX,
			y: geometry.y,
		}),
		transientActorLayer,
	});
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
		...harness,
		actors,
		canceledAnimationKeys: harness.canceledOwnerKeys,
		canonicalItems,
		cue,
		setGeometry: (next: typeof geometry) => {
			geometry = next;
		},
		source,
		target,
	};
};

export const createSpawnHarness = () => {
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
		] as const,
		[
			spawned.item.id,
			spawned,
		] as const,
	]);
	const canonicalItems = new Map([
		[
			blocker.item.id,
			blocker.item,
		] as const,
		[
			spawned.item.id,
			spawned.item,
		] as const,
	]);
	const transientActorLayer = new Container();
	const harness = createMotionHarness({
		actors,
		canonicalItems,
		readPose: (location) => ({
			layer: transientActorLayer,
			size: 80,
			x: location.position.x * 100,
			y: 40,
		}),
		transientActorLayer,
	});
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
		...harness,
		blocker,
		blockerCue,
		canceledAnimationKeys: harness.canceledOwnerKeys,
		spawnCue,
		spawned,
	};
};

export const createStackHarness = () => {
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
		] as const,
	]);
	const canonicalItems = new Map([
		[
			target.item.id,
			canonicalTarget,
		] as const,
	]);
	const harness = createMotionHarness({
		actors,
		canonicalItems,
	});
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
		...harness,
		actors,
		canonicalItems,
		cue,
		target,
	};
};

export type {
	PixiActorAnimation,
	PixiActorAnimationChannel,
	PixiApplicationOwner,
	PixiMainSceneActorStore,
	PixiMainSceneSurface,
	PixiScenePalette,
	PixiTileActor,
	PixiTileMagneticFieldSample,
	TileActorItem,
	TileMotionCue,
};
