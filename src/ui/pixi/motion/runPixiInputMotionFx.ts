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
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { startPixiTileActorRemovalFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import { startPixiTileActorVanishFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorVanishFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { flashPixiMotionTargetFx } from "~/ui/pixi/motion/flashPixiMotionTargetFx";
import { readPixiLiveActorContactPose } from "~/ui/pixi/motion/readPixiLiveActorContactPose";
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
		readonly readSourceSurvives: () => boolean;
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
	readonly source: PixiTileActor | null;
	readonly transient: PixiTileActor;
}) {
	const sourceStillCanonical =
		source !== null &&
		source === transient &&
		actorStore.actors.get(source.item.id) === source &&
		actorStore.canonicalItems.has(source.item.id);
	if (!sourceStillCanonical) {
		yield* destroyPixiInputTransientFx({
			animator,
			transient,
		});
	}
	if (
		source !== null &&
		actorStore.actors.get(source.item.id) === source &&
		!actorStore.canonicalItems.has(source.item.id)
	) {
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
	readonly readPalette: () => PixiScenePalette;
	readonly source: PixiTileActor | null;
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
			badgeCount: cue.resultingQuantity > 1 ? cue.resultingQuantity : undefined,
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
			source?.item.id ?? cue.originActorId,
		]),
		magneticField,
	});
	const readLiveOrigin = () => {
		if (source !== null && !source.dragging) return null;
		return readPixiLiveActorContactPose({
			actorId: cue.originActorId,
			actors: actorStore.actors,
			movingActorSize: transient.size,
		});
	};
	yield* chasePixiTileMotionTargetFx({
		actor: transient,
		animator,
		curve: {
			kind: "linear",
		},
		fallbackTarget: sourceHome,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			RendererRuntime.runSync(
				Effect.gen(function* () {
					const latestHome =
						(yield* surface.readLocationPoseFx(cue.originLocation)) ?? sourceHome;
					if (source === null) {
						let settled = false;
						const settle = () => {
							if (settled) return;
							settled = true;
							RendererRuntime.runSync(
								Effect.gen(function* () {
									yield* destroyPixiInputTransientFx({
										animator,
										transient,
									});
									onComplete();
								}),
							);
						};
						yield* startPixiTileActorVanishFeedbackFx({
							actor: transient,
							animator,
							onCancel: settle,
							onComplete: settle,
						});
						return;
					}
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
					if (transient === source) {
						source.container.eventMode = "static";
					} else {
						yield* destroyPixiInputTransientFx({
							animator,
							transient,
						});
					}
					onComplete();
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget: readLiveOrigin,
		surface,
		targetLocation: cue.originLocation,
	});
});

/**
 * Delivers one complete source stack and returns only a remainder that survives canonical truth.
 * A directly dragged source keeps one physical actor through delivery and return. Other surviving
 * inputs use a clone so overlapping committed cues cannot fight over the canonical actor.
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
	onTransientCreated,
	origin,
	readPalette,
	readSourceSurvives,
	surface,
	target,
	textures,
}: runPixiInputMotionFx.Props) {
	const candidateSource = actorStore.actors.get(cue.sourceActorId);
	const source =
		candidateSource === undefined || candidateSource.container.destroyed
			? null
			: candidateSource;
	const sourceItem = source?.item ?? cue.sourceItem;
	if (sourceItem === undefined) {
		const targetActor = actorStore.actors.get(cue.targetActorId);
		if (targetActor !== undefined) {
			yield* burstPixiTileActorFeedbackParticlesFx({
				actor: targetActor,
				animator,
			});
		}
		onComplete();
		return;
	}

	const sourceSurvives = () => cue.resultingQuantity > 0 && readSourceSurvives();
	// An accepted direct drop remains in this layer until its committed cue takes ownership.
	// Keeping that actor avoids a visible clone-to-canonical swap of its magnetic offset.
	const reusesPresentedSource =
		source !== null &&
		sourceSurvives() &&
		source.container.parent === surface.transientActorLayer;
	const transient =
		source === null || (sourceSurvives() && !reusesPresentedSource)
			? yield* createPixiTileActorFx({
					frames: application.frames,
					item: {
						...sourceItem,
						badgeCount: cue.previousQuantity > 1 ? cue.previousQuantity : undefined,
						id: `motion:${cueKey}`,
						quantity: cue.previousQuantity,
					},
					palette: readPalette(),
					textures,
				})
			: source;
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
	if (transient !== source) {
		yield* animator.setFx({
			actor: transient,
			channel: "pose",
			scale: origin.size / Math.max(1, transient.size),
			x: origin.x,
			y: origin.y,
		});
	}

	const sourceHome = yield* surface.readLocationPoseFx(cue.originLocation);
	if (sourceSurvives() && source !== null && transient !== source) {
		source.lifecycleIntentGeneration += 1;
		source.lifecycleTargetAlpha = 0;
		source.lifecycleFadeStarted = true;
		yield* animator.cancelFx(readPixiActorAlphaAnimationKey(source));
		yield* animator.setFx({
			actor: source,
			alpha: 0,
			channel: "lifecycle-opacity",
		});
	}
	if (sourceSurvives() && source !== null && transient !== source && sourceHome !== null) {
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
		return readPixiLiveActorContactPose({
			actorId: cue.targetActorId,
			actors: actorStore.actors,
			movingActorSize: transient.size,
		});
	};
	const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
		actor: transient,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
	});
	yield* chasePixiTileMotionTargetFx({
		actor: transient,
		animator,
		curve: {
			kind: "linear",
		},
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			RendererRuntime.runSync(
				flashPixiMotionTargetFx({
					actorStore,
					animator,
					targetActorId: cue.targetActorId,
				}),
			);
			if (sourceSurvives()) {
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
					Effect.gen(function* () {
						let settled = false;
						const settle = () => {
							if (settled) return;
							settled = true;
							RendererRuntime.runSync(
								Effect.gen(function* () {
									yield* destroyPixiInputTransientFx({
										animator,
										transient,
									});
									onComplete();
								}),
							);
						};
						yield* startPixiTileActorRemovalFeedbackFx({
							actor: transient,
							animator,
							onCancel: settle,
							onComplete: settle,
						});
					}),
				);
				return;
			}
			RendererRuntime.runSync(
				Effect.gen(function* () {
					let settled = false;
					const settle = () => {
						if (settled) return;
						settled = true;
						RendererRuntime.runSync(
							finishPixiConsumedInputStackFx({
								actorStore,
								animator,
								onComplete,
								source,
								transient,
							}),
						);
					};
					yield* startPixiTileActorRemovalFeedbackFx({
						actor: transient,
						animator,
						onCancel: settle,
						onComplete: settle,
					});
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget,
		surface,
		targetLocation: cue.targetLocation,
	});
});
