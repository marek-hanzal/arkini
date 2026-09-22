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
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
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
		readonly isCueActiveFn: () => boolean;
		readonly onActorSettledFn: (actor: PixiTileActor) => void;
		readonly onCompleteFn: () => void;
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
const finishConsumedItemFx = Effect.fn("finishConsumedItemFx")(function* ({
	actorStore,
	animator,
	onActorSettledFn,
	onCompleteFn,
	source,
}: {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly onActorSettledFn: (actor: PixiTileActor) => void;
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
	onActorSettledFn(source);
	onCompleteFn();
});

/** Delivers one source item to its receiver before retiring the physical actor. */
export const runInputMotionFx = Effect.fn("runInputMotionFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	delayMs,
	isCueActiveFn,
	onActorSettledFn,
	onCompleteFn,
	readPaletteFn,
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

	const readLiveTargetFn = () => {
		return readLiveContactPoseFn({
			actorId: cue.targetActorId,
			actors: actorStore.actors,
			movingActor: source,
		});
	};
	yield* chaseTargetFx({
		actor: source,
		animator,
		curve: inputArrivalCurve,
		delayMs,
		fallbackTarget: target,
		onSettledFn: () => {
			if (!isCueActiveFn()) return;
			RendererRuntime.runSync(
				flashMotionTargetFx({
					actorStore,
					animator,
					targetActorId: cue.targetActorId,
				}),
			);
			RendererRuntime.runSync(
				Effect.gen(function* () {
					let settled = false;
					const settleFn = () => {
						if (settled || !isCueActiveFn()) return;
						settled = true;
						RendererRuntime.runSync(
							finishConsumedItemFx({
								actorStore,
								animator,
								onActorSettledFn,
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
