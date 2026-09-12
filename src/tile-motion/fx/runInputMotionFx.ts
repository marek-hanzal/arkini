import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileInputMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
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
		readonly isCueActiveFn: () => boolean;
		readonly onCompleteFn: () => void;
		readonly onRemainderRevealedFn: () => void;
		readonly readSourceSurvivesFn: () => boolean;
		readonly readPaletteFn: () => PixiScenePalette;
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

const finishConsumedStackFx = Effect.fn("finishConsumedStackFx")(function* ({
	actorStore,
	animator,
	onCompleteFn,
	source,
}: {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly onCompleteFn: () => void;
	readonly source: PixiTileActor;
}) {
	const retained = actorStore.actors.get(source.item.id) === source;
	const canonical = actorStore.canonicalItems.has(source.item.id);
	if (!retained || !canonical) {
		yield* animator.cancelActorFx(source);
		yield* destroyTileActorFx(source);
	}
	if (
		actorStore.actors.get(source.item.id) === source &&
		!actorStore.canonicalItems.has(source.item.id)
	) {
		yield* actorStore.releaseActorFx(source.item.id);
	}
	onCompleteFn();
});

const flashInputRemainderFx = Effect.fn("flashInputRemainderFx")(function* ({
	animator,
	cueKey,
	onCompleteFn,
	onRemainderRevealedFn,
	source,
}: {
	readonly animator: ActorAnimator;
	readonly cueKey: string;
	readonly onCompleteFn: () => void;
	readonly onRemainderRevealedFn: () => void;
	readonly source: PixiTileActor;
}) {
	const ownerKey = `motion:${cueKey}:consume`;
	yield* startRemainderFeedbackFx({
		actor: source,
		animator,
		onCancelFn: onCompleteFn,
		onHiddenFx: Effect.sync(onRemainderRevealedFn),
		onRevealedFn: onCompleteFn,
		ownerKey,
	});
});

const returnInputRemainderFx = Effect.fn("returnInputRemainderFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	magneticField,
	isCueActiveFn,
	onCompleteFn,
	source,
	sourceHome,
	surface,
}: {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly cue: TileInputMotionCue;
	readonly cueKey: string;
	readonly magneticField: MagneticField;
	readonly isCueActiveFn: () => boolean;
	readonly onCompleteFn: () => void;
	readonly source: PixiTileActor;
	readonly sourceHome: ActorPose;
	readonly surface: MainSurface;
}) {
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: source,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set([
			source.item.id,
		]),
		magneticField,
		surface,
	});
	yield* chaseTargetFx({
		actor: source,
		animator,
		curve: inputReturnCurve,
		fallbackTarget: sourceHome,
		onPoseFn: magneticProjector.projectPoseFn,
		onSettledFn: () => {
			if (!isCueActiveFn()) return;
			magneticProjector.releaseFn();
			RendererRuntime.runSync(
				Effect.gen(function* () {
					const latestHome =
						(yield* surface.readLocationPoseFx(cue.originLocation)) ?? sourceHome;
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
					onCompleteFn();
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTargetFn: () => null,
		surface,
		targetLocation: cue.originLocation,
	});
});

/**
 * Delivers one complete source stack and returns only a remainder that survives canonical truth.
 * The source keeps one physical actor through delivery and return; missing visual identities
 * receive target feedback without inventing an off-canvas payload.
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
	isCueActiveFn,
	onCompleteFn,
	onRemainderRevealedFn,
	readPaletteFn,
	readSourceSurvivesFn,
	surface,
	target,
	textures,
}: runInputMotionFx.Props) {
	const readLiveContactPoseFn = yield* createLiveContactPoseReaderFx();
	const source = actorStore.actors.get(cue.sourceActorId);
	if (source === undefined || source.container.destroyed) {
		const targetActor = actorStore.actors.get(cue.targetActorId);
		if (targetActor !== undefined)
			yield* burstFeedbackParticlesFx({
				actor: targetActor,
				animator,
			});
		onCompleteFn();
		return;
	}
	const sourceSurvivesFn = () => cue.resultingQuantity > 0 && readSourceSurvivesFn();
	source.container.eventMode = "none";
	surface.transientActorLayer.addChild(source.container);
	yield* updateTileActorFx({
		actor: source,
		animator,
		frames: application.frames,
		item: source.item,
		palette: readPaletteFn(),
		size: target.size,
		textures,
	});
	yield* animator.setFx({
		actor: source,
		alpha: 1,
		channel: "lifecycle-opacity",
	});

	const sourceHome = yield* surface.readLocationPoseFx(cue.originLocation);

	const readLiveTargetFn = () => {
		return readLiveContactPoseFn({
			actorId: cue.targetActorId,
			actors: actorStore.actors,
			movingActor: source,
		});
	};
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: source,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
		surface,
	});
	yield* chaseTargetFx({
		actor: source,
		animator,
		curve: inputArrivalCurve,
		delayMs,
		fallbackTarget: target,
		onPoseFn: magneticProjector.projectPoseFn,
		onSettledFn: () => {
			if (!isCueActiveFn()) return;
			magneticProjector.releaseFn();
			RendererRuntime.runSync(
				flashMotionTargetFx({
					actorStore,
					animator,
					targetActorId: cue.targetActorId,
				}),
			);
			if (sourceSurvivesFn()) {
				if (sourceHome !== null) {
					RendererRuntime.runSync(
						flashInputRemainderFx({
							animator,
							cueKey,
							onCompleteFn: () => {
								if (!isCueActiveFn()) return;
								RendererRuntime.runSync(
									returnInputRemainderFx({
										isCueActiveFn,
										actorStore,
										animator,
										cue,
										cueKey,
										magneticField,
										onCompleteFn,
										source,
										sourceHome,
										surface,
									}),
								);
							},
							source,
							onRemainderRevealedFn: () => {
								if (!isCueActiveFn()) return;
								onRemainderRevealedFn();
							},
						}),
					);
					return;
				}
				source.container.eventMode = "static";
				onCompleteFn();
				return;
			}
			RendererRuntime.runSync(
				Effect.gen(function* () {
					let settled = false;
					const settleFn = () => {
						if (settled || !isCueActiveFn()) return;
						settled = true;
						RendererRuntime.runSync(
							finishConsumedStackFx({
								actorStore,
								animator,
								onCompleteFn,
								source,
							}),
						);
					};
					yield* startActorExitFx({
						actor: source,
						animator,
						onCancelFn: settleFn,
						onCompleteFn: settleFn,
					});
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTargetFn,
		surface,
		targetLocation: cue.targetLocation,
	});
});
