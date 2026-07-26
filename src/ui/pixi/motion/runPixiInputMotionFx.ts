import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileInputMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiActorAlphaAnimationKey } from "~/ui/pixi/animation/readPixiActorAlphaAnimationKey";
import { flashPixiTileActorFeedbackGlowFx } from "~/ui/pixi/animation/runPixiTileActorRunningGlowFx";
import { startPixiTileActorRemovalFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runPixiInputMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileInputMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: PixiTileMagneticField;
		readonly onComplete: () => void;
		readonly onMagneticSourceAcquired: (actorId: string) => void;
		readonly onMagneticSourceReleased: (actorId: string) => void;
		readonly onTransientCreated: (actor: PixiTileActor) => void;
		readonly origin: PixiTileActorPose;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
		readonly textures: PixiTextureStore;
	}
}

const destroyPixiInputTransientFx = Effect.fn("destroyPixiInputTransientFx")(function* ({
	animator,
	transient,
}: {
	readonly animator: PixiActorAnimator;
	readonly transient: PixiTileActor;
}) {
	yield* animator.cancelActorFx(transient);
	yield* destroyPixiTileActorFx(transient);
});

const finishPixiConsumedInputStackFx = Effect.fn("finishPixiConsumedInputStackFx")(function* ({
	actorStore,
	animator,
	onComplete,
	source,
	transient,
}: {
	readonly actorStore: PixiMainSceneActorStore;
	readonly animator: PixiActorAnimator;
	readonly onComplete: () => void;
	readonly source: PixiTileActor;
	readonly transient: PixiTileActor;
}) {
	yield* destroyPixiInputTransientFx({
		animator,
		transient,
	});
	if (actorStore.actors.get(source.item.id) === source) {
		yield* actorStore.releaseActorFx(source.item.id);
		yield* animator.cancelActorFx(source);
		if (!source.container.destroyed) {
			yield* actorStore.destroyExitingActorFx(source);
		}
	}
	onComplete();
});

const returnPixiInputRemainderFx = Effect.fn("returnPixiInputRemainderFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	magneticField,
	onComplete,
	onMagneticSourceAcquired,
	onMagneticSourceReleased,
	readPalette,
	source,
	sourceHome,
	surface,
	textures,
	transient,
}: {
	readonly actorStore: PixiMainSceneActorStore;
	readonly animator: PixiActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly cue: TileInputMotionCue;
	readonly cueKey: string;
	readonly magneticField: PixiTileMagneticField;
	readonly onComplete: () => void;
	readonly onMagneticSourceAcquired: (actorId: string) => void;
	readonly onMagneticSourceReleased: (actorId: string) => void;
	readonly readPalette: () => PixiScenePalette;
	readonly source: PixiTileActor;
	readonly sourceHome: PixiTileActorPose;
	readonly surface: PixiMainSceneSurface;
	readonly textures: PixiTextureStore;
	readonly transient: PixiTileActor;
}) {
	yield* updatePixiTileActorFx({
		actor: transient,
		animator,
		frames: application.frames,
		item: {
			...transient.item,
			quantity: cue.resultingQuantity,
		},
		palette: readPalette(),
		size: transient.size,
		textures,
	});
	const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
		actor: transient,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set([
			cue.sourceActorId,
		]),
		magneticField,
		onAcquired: onMagneticSourceAcquired,
		onReleased: onMagneticSourceReleased,
	});
	yield* chasePixiTileMotionTargetFx({
		actor: transient,
		animator,
		fallbackTarget: sourceHome,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			RendererRuntime.runSync(
				Effect.gen(function* () {
					const latestHome =
						(yield* surface.readLocationPoseFx(cue.originLocation)) ?? sourceHome;
					if (
						actorStore.actors.get(cue.sourceActorId) === source &&
						!source.container.destroyed
					) {
						const canonical =
							actorStore.canonicalItems.get(cue.sourceActorId) ?? source.item;
						latestHome.layer.addChild(source.container);
						yield* updatePixiTileActorFx({
							actor: source,
							animator,
							frames: application.frames,
							item: {
								...canonical,
								quantity: cue.resultingQuantity,
							},
							palette: readPalette(),
							size: latestHome.size,
							textures,
						});
						yield* animator.setFx({
							actor: source,
							channel: "pose",
							scale: latestHome.size / Math.max(1, source.size),
							x: latestHome.x,
							y: latestHome.y,
						});
						source.lifecycleIntentGeneration += 1;
						source.lifecycleTargetAlpha = 1;
						source.lifecycleFadeStarted = true;
						source.lifecycleNotBeforeMs = performance.now();
						source.lifecycleDurationMs = 0;
						yield* animator.cancelFx(readPixiActorAlphaAnimationKey(source));
						yield* animator.setFx({
							actor: source,
							alpha: 1,
							channel: "lifecycle-opacity",
						});
					}
					yield* destroyPixiInputTransientFx({
						animator,
						transient,
					});
					onComplete();
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget: () => null,
		surface,
		targetLocation: cue.originLocation,
	});
});

/**
 * Delivers one complete source stack and returns only a remainder that survives canonical truth.
 *
 * Several immediately committed input stores may consume one source before the oldest visual cue
 * reaches contact. An intermediate event remainder must not return as a ghost when the latest
 * canonical snapshot already removed that source.
 */
export const runPixiInputMotionFx = Effect.fn("runPixiInputMotionFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onComplete,
	onMagneticSourceAcquired,
	onMagneticSourceReleased,
	onTransientCreated,
	origin,
	readPalette,
	surface,
	target,
	textures,
}: runPixiInputMotionFx.Props) {
	const source = actorStore.actors.get(cue.sourceActorId);
	if (source === undefined || source.container.destroyed) {
		const targetActor = actorStore.actors.get(cue.targetActorId);
		if (targetActor !== undefined) {
			yield* flashPixiTileActorFeedbackGlowFx({
				actor: targetActor,
				animator,
			});
		}
		onComplete();
		return;
	}

	const transient = yield* createPixiTileActorFx({
		frames: application.frames,
		item: {
			...source.item,
			id: `motion:${cueKey}`,
			quantity: cue.previousQuantity,
		},
		palette: readPalette(),
		textures,
	});
	transient.container.eventMode = "none";
	onTransientCreated(transient);
	surface.transientActorLayer.addChild(transient.container);
	yield* updatePixiTileActorFx({
		actor: transient,
		animator,
		frames: application.frames,
		item: transient.item,
		palette: readPalette(),
		size: target.size,
		textures,
	});
	yield* animator.setFx({
		actor: transient,
		alpha: 1,
		channel: "lifecycle-opacity",
	});
	yield* animator.setFx({
		actor: transient,
		channel: "pose",
		scale: origin.size / Math.max(1, transient.size),
		x: origin.x,
		y: origin.y,
	});

	source.lifecycleIntentGeneration += 1;
	source.lifecycleTargetAlpha = 0;
	source.lifecycleFadeStarted = true;
	yield* animator.cancelFx(readPixiActorAlphaAnimationKey(source));
	yield* animator.setFx({
		actor: source,
		alpha: 0,
		channel: "lifecycle-opacity",
	});
	const sourceHome = yield* surface.readLocationPoseFx(cue.originLocation);
	if (sourceHome !== null) {
		sourceHome.layer.addChild(source.container);
		yield* animator.setFx({
			actor: source,
			channel: "pose",
			scale: sourceHome.size / Math.max(1, source.size),
			x: sourceHome.x,
			y: sourceHome.y,
		});
	}

	const readLiveTarget = () => {
		const actor = actorStore.actors.get(cue.targetActorId);
		if (actor === undefined || actor.container.destroyed) return null;
		const scale = actor.container.scale.x;
		return {
			scale: (actor.size * scale) / Math.max(1, transient.size),
			x: actor.container.x - actor.container.pivot.x * scale,
			y: actor.container.y - actor.container.pivot.y * scale,
		};
	};
	const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
		actor: transient,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
		onAcquired: onMagneticSourceAcquired,
		onReleased: onMagneticSourceReleased,
	});
	yield* chasePixiTileMotionTargetFx({
		actor: transient,
		animator,
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			const targetActor = actorStore.actors.get(cue.targetActorId);
			if (targetActor !== undefined) {
				RendererRuntime.runSync(
					flashPixiTileActorFeedbackGlowFx({
						actor: targetActor,
						animator,
					}),
				);
			}
			if (cue.resultingQuantity > 0 && actorStore.canonicalItems.has(cue.sourceActorId)) {
				if (sourceHome !== null) {
					RendererRuntime.runSync(
						returnPixiInputRemainderFx({
							actorStore,
							animator,
							application,
							cue,
							cueKey,
							magneticField,
							onComplete,
							onMagneticSourceAcquired,
							onMagneticSourceReleased,
							readPalette,
							source,
							sourceHome,
							surface,
							textures,
							transient,
						}),
					);
					return;
				}
				RendererRuntime.runSync(
					startPixiTileActorRemovalFeedbackFx({
						actor: transient,
						animator,
						onComplete: () => {
							RendererRuntime.runSync(
								Effect.gen(function* () {
									yield* destroyPixiInputTransientFx({
										animator,
										transient,
									});
									onComplete();
								}),
							);
						},
					}),
				);
				return;
			}
			RendererRuntime.runSync(
				startPixiTileActorRemovalFeedbackFx({
					actor: transient,
					animator,
					onComplete: () => {
						RendererRuntime.runSync(
							finishPixiConsumedInputStackFx({
								actorStore,
								animator,
								onComplete,
								source,
								transient,
							}),
						);
					},
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget,
		surface,
		targetLocation: cue.targetLocation,
	});
});
