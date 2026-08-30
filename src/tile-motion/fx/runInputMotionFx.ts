import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileInputMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { createTileActorFx } from "~/tile-rendering/fx/createTileActorFx";
import { destroyTileActorFx } from "~/tile-rendering/fx/destroyTileActorFx";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { burstFeedbackParticlesFx } from "~/tile-rendering/fx/burstFeedbackParticlesFx";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import { startRemainderFeedbackFx } from "~/tile-rendering/fx/startRemainderFeedbackFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
import { createLiveContactPoseReaderFx } from "~/tile-motion/fx/createLiveContactPoseReaderFx";
import { flashMotionTargetFx } from "~/tile-motion/fx/flashMotionTargetFx";
import { projectMotionItemFn } from "~/tile-motion/fn/projectMotionItemFn";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export namespace runInputMotionFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileInputMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: MagneticField;
		readonly onComplete: () => void;
		readonly onRemainderRevealed: () => void;
		readonly readSourceSurvives: () => boolean;
		readonly onPayloadCreated: (actor: PixiTileActor) => void;
		readonly origin: ActorPose;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: MainSurface;
		readonly target: ActorPose;
		readonly textures: TextureStore;
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

const destroyInputTransientFx = Effect.fn("destroyInputTransientFx")(function* ({
	animator,
	transient,
}: {
	readonly animator: ActorAnimator;
	readonly transient: PixiTileActor;
}) {
	yield* animator.cancelActorFx(transient);
	yield* destroyTileActorFx(transient);
});

const exitAndDestroyInputTransientFx = Effect.fn("exitAndDestroyInputTransientFx")(function* ({
	animator,
	onComplete,
	transient,
}: {
	readonly animator: ActorAnimator;
	readonly onComplete: () => void;
	readonly transient: PixiTileActor;
}) {
	let settled = false;
	const settle = () => {
		if (settled) return;
		settled = true;
		RendererRuntime.runSync(
			Effect.gen(function* () {
				yield* destroyInputTransientFx({
					animator,
					transient,
				});
				onComplete();
			}),
		);
	};
	yield* startActorExitFx({
		actor: transient,
		animator,
		onCancel: settle,
		onComplete: settle,
	});
});

const finishConsumedStackFx = Effect.fn("finishConsumedStackFx")(function* ({
	actorStore,
	animator,
	onComplete,
	source,
	transient,
}: {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
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
		yield* destroyInputTransientFx({
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

const flashInputRemainderFx = Effect.fn("flashInputRemainderFx")(function* ({
	animator,
	cueKey,
	onComplete,
	onRemainderRevealed,
	transient,
}: {
	readonly animator: ActorAnimator;
	readonly cueKey: string;
	readonly onComplete: () => void;
	readonly onRemainderRevealed: () => void;
	readonly transient: PixiTileActor;
}) {
	const ownerKey = `motion:${cueKey}:consume`;
	yield* startRemainderFeedbackFx({
		actor: transient,
		animator,
		onCancel: onComplete,
		onHiddenFx: Effect.sync(onRemainderRevealed),
		onRevealed: onComplete,
		ownerKey,
	});
});

const returnInputRemainderFx = Effect.fn("returnInputRemainderFx")(function* ({
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
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly cue: TileInputMotionCue;
	readonly cueKey: string;
	readonly magneticField: MagneticField;
	readonly onComplete: () => void;
	readonly source: PixiTileActor | null;
	readonly sourceHome: ActorPose;
	readonly surface: MainSurface;
	readonly transient: PixiTileActor;
}) {
	const readLiveContactPose = yield* createLiveContactPoseReaderFx();
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: transient,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set([
			source?.item.id ?? cue.originActorId,
		]),
		magneticField,
		surface,
	});
	const readLiveOrigin = () => {
		if (source !== null) return null;
		return readLiveContactPose({
			actorId: cue.originActorId,
			actors: actorStore.actors,
			movingActor: transient,
		});
	};
	yield* chaseTargetFx({
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
						yield* exitAndDestroyInputTransientFx({
							animator,
							onComplete,
							transient,
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
export const runInputMotionFx = Effect.fn("runInputMotionFx")(function* ({
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
}: runInputMotionFx.Props) {
	const readLiveContactPose = yield* createLiveContactPoseReaderFx();
	const candidateSource = actorStore.actors.get(cue.sourceActorId);
	const source =
		candidateSource === undefined || candidateSource.container.destroyed
			? null
			: candidateSource;
	const sourceItem = source?.item ?? cue.sourceItem;
	if (sourceItem === undefined) {
		const targetActor = actorStore.actors.get(cue.targetActorId);
		if (targetActor !== undefined) {
			yield* burstFeedbackParticlesFx({
				actor: targetActor,
				animator,
			});
		}
		onComplete();
		return;
	}

	const deliveryItem = projectMotionItemFn(
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
			? yield* createTileActorFx({
					frames: application.frames,
					item: deliveryItem,
					palette: readPalette(),
					textures,
				})
			: source;
	transient.container.eventMode = "none";
	if (source === null) onPayloadCreated(transient);
	surface.transientActorLayer.addChild(transient.container);
	yield* updateTileActorFx({
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
		return readLiveContactPose({
			actorId: cue.targetActorId,
			actors: actorStore.actors,
			movingActor: transient,
		});
	};
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: transient,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
		surface,
	});
	yield* chaseTargetFx({
		actor: transient,
		animator,
		curve: inputArrivalCurve,
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			RendererRuntime.runSync(
				flashMotionTargetFx({
					actorStore,
					animator,
					targetActorId: cue.targetActorId,
				}),
			);
			if (sourceSurvives()) {
				if (sourceHome !== null) {
					RendererRuntime.runSync(
						flashInputRemainderFx({
							animator,
							cueKey,
							onComplete: () => {
								RendererRuntime.runSync(
									returnInputRemainderFx({
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
										updateTileActorFx({
											actor: transient,
											animator,
											frames: application.frames,
											item: projectMotionItemFn(transient.item, {
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
					exitAndDestroyInputTransientFx({
						animator,
						onComplete,
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
							finishConsumedStackFx({
								actorStore,
								animator,
								onComplete,
								source,
								transient,
							}),
						);
					};
					yield* startActorExitFx({
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
