import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileInputMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { burstPixiTileActorFeedbackParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
import { startPixiTileActorRemovalFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import { startPixiTileActorVanishFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorVanishFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { flashPixiMotionTargetFx } from "~/ui/pixi/motion/flashPixiMotionTargetFx";
import { projectPixiTileMotionItem } from "~/ui/pixi/motion/projectPixiTileMotionItem";
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
		readonly onRemainderRevealed: () => void;
		readonly readSourceSurvives: () => boolean;
		readonly onPayloadCreated: (actor: PixiTileActor) => void;
		readonly origin: PixiTileActorPose;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
		readonly textures: PixiTextureStore;
	}
}

const inputArrivalCurve = {
	bounce: 0.1,
	kind: "spring",
} as const;
const inputReturnCurve = {
	bounce: 0.22,
	kind: "spring",
} as const;
const inputConsumeFadeOutDurationMs = 275;
const inputConsumeFadeInDurationMs = 375;

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

const flashPixiInputRemainderFx = Effect.fn("flashPixiInputRemainderFx")(function* ({
	animator,
	cueKey,
	onComplete,
	onRemainderRevealed,
	transient,
}: {
	readonly animator: PixiActorAnimator;
	readonly cueKey: string;
	readonly onComplete: () => void;
	readonly onRemainderRevealed: () => void;
	readonly transient: PixiTileActor;
}) {
	const ownerKey = `motion:${cueKey}:consume`;
	yield* animator.animateFx({
		actor: transient,
		channel: "lifecycle-opacity",
		durationMs: inputConsumeFadeOutDurationMs,
		ownerKey,
		onCancel: onComplete,
		onComplete: () => {
			if (transient.container.destroyed) return;
			RendererRuntime.runSync(
				Effect.gen(function* () {
					onRemainderRevealed();
					yield* animator.animateFx({
						actor: transient,
						channel: "lifecycle-opacity",
						durationMs: inputConsumeFadeInDurationMs,
						ownerKey,
						onCancel: onComplete,
						onComplete,
						toAlpha: 1,
					});
				}),
			);
		},
		toAlpha: 0,
	});
});

const returnPixiInputRemainderFx = Effect.fn("returnPixiInputRemainderFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	magneticField,
	onComplete,
	source,
	sourceHome,
	surface,
	transient,
}: {
	readonly actorStore: PixiMainSceneActorStore;
	readonly animator: PixiActorAnimator;
	readonly cue: TileInputMotionCue;
	readonly cueKey: string;
	readonly magneticField: PixiTileMagneticField;
	readonly onComplete: () => void;
	readonly source: PixiTileActor | null;
	readonly sourceHome: PixiTileActorPose;
	readonly surface: PixiMainSceneSurface;
	readonly transient: PixiTileActor;
}) {
	const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
		actor: transient,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set([
			source?.item.id ?? cue.originActorId,
		]),
		magneticField,
	});
	const readLiveOrigin = () => {
		if (source !== null) return null;
		return readPixiLiveActorContactPose({
			actorId: cue.originActorId,
			actors: actorStore.actors,
			movingActorSize: transient.size,
		});
	};
	yield* chasePixiTileMotionTargetFx({
		actor: transient,
		animator,
		curve: inputReturnCurve,
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
						latestHome.layer.addChild(source.container);
						yield* animator.setFx({
							actor: source,
							channel: "pose",
							scale: latestHome.size / Math.max(1, source.size),
							x: latestHome.x,
							y: latestHome.y,
						});
						source.container.eventMode = "static";
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
 * A visible source keeps one physical actor through delivery and return. Inventory-only sources
 * use a short-lived payload because their actor belongs to another surface.
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
	onRemainderRevealed,
	onPayloadCreated,
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

	const deliveryItem = projectPixiTileMotionItem(
		{
			...sourceItem,
			id: source === null ? `motion:${cueKey}` : sourceItem.id,
		},
		{
			kind: "exact",
			quantity: cue.previousQuantity,
		},
	);
	const sourceSurvives = () => cue.resultingQuantity > 0 && readSourceSurvives();
	const transient =
		source === null
			? yield* createPixiTileActorFx({
					frames: application.frames,
					item: deliveryItem,
					palette: readPalette(),
					textures,
				})
			: source;
	transient.container.eventMode = "none";
	if (source === null) onPayloadCreated(transient);
	surface.transientActorLayer.addChild(transient.container);
	yield* updatePixiTileActorFx({
		actor: transient,
		animator,
		frames: application.frames,
		item: source === null ? deliveryItem : source.item,
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
		curve: inputArrivalCurve,
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
						flashPixiInputRemainderFx({
							animator,
							cueKey,
							onComplete: () => {
								RendererRuntime.runSync(
									returnPixiInputRemainderFx({
										actorStore,
										animator,
										cue,
										cueKey,
										magneticField,
										onComplete,
										source,
										sourceHome,
										surface,
										transient,
									}),
								);
							},
							onRemainderRevealed: () => {
								if (source === null) {
									RendererRuntime.runSync(
										updatePixiTileActorFx({
											actor: transient,
											animator,
											frames: application.frames,
											item: projectPixiTileMotionItem(transient.item, {
												kind: "exact",
												quantity: cue.resultingQuantity,
											}),
											palette: readPalette(),
											size: transient.size,
											textures,
										}),
									);
								}
								onRemainderRevealed();
							},
							transient,
						}),
					);
					return;
				}
				if (source !== null) {
					source.container.eventMode = "static";
					onComplete();
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
