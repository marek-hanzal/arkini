import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileStackMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createTileActorFx } from "~/ui/pixi/actor/createTileActorFx";
import { destroyTileActorFx } from "~/ui/pixi/actor/destroyTileActorFx";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { restoreActorExitFx } from "~/ui/pixi/animation/restoreActorExitFx";
import { startActorEnterFx } from "~/ui/pixi/animation/startActorEnterFx";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import { chaseTargetFx } from "~/ui/pixi/motion/chaseTargetFx";
import { createMagneticProjectorFx } from "~/ui/pixi/motion/createMagneticProjectorFx";
import { flashMotionTargetFx } from "~/ui/pixi/motion/flashMotionTargetFx";
import { projectMotionItemFn } from "~/ui/pixi/motion/fn/projectMotionItemFn";
import { makeLiveContactPoseReaderFx } from "~/ui/pixi/motion/makeLiveContactPoseReaderFx";
import type { TargetRoute } from "~/ui/pixi/motion/MotionTarget";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export namespace runStackMotionFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileStackMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: MagneticField;
		readonly onComplete: () => void;
		readonly onPayloadCreated: (actor: PixiTileActor) => void;
		readonly origin: ActorPose;
		readonly readPalette: () => PixiScenePalette;
		readonly readTargetRoute: (
			actorId: string,
			location: TargetRoute["location"],
		) => TargetRoute;
		readonly surface: MainSurface;
		readonly target: ActorPose;
		readonly textures: TextureStore;
	}
}

/** Animates a consumed source actor or an identity-free produced stack payload. */
export const runStackMotionFx = Effect.fn("runStackMotionFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onComplete,
	onPayloadCreated,
	origin,
	readPalette,
	readTargetRoute,
	surface,
	target,
	textures,
}: runStackMotionFx.Props) {
	const readLiveContactPose = yield* makeLiveContactPoseReaderFx();
	const canonical =
		actorStore.canonicalItems.get(cue.targetActorId) ??
		actorStore.actors.get(cue.targetActorId)?.item;
	if (canonical === undefined) {
		onComplete();
		return;
	}
	const candidateSource = actorStore.actors.get(cue.originActorId);
	const source =
		candidateSource?.item.itemId === cue.canonicalItemId &&
		!actorStore.canonicalItems.has(cue.originActorId)
			? candidateSource
			: null;
	const payload =
		source ??
		(yield* createTileActorFx({
			frames: application.frames,
			item: projectMotionItemFn(
				{
					...canonical,
					id: `motion:${cueKey}`,
				},
				{
					kind: "exact",
					quantity: cue.quantity,
				},
			),
			palette: readPalette(),
			textures,
		}));
	if (source !== null) {
		yield* restoreActorExitFx({
			actor: source,
			animator,
		});
	}
	payload.container.eventMode = "none";
	if (source === null) onPayloadCreated(payload);
	surface.transientActorLayer.addChild(payload.container);
	yield* updateTileActorFx({
		actor: payload,
		animator,
		frames: application.frames,
		item: payload.item,
		palette: readPalette(),
		size: target.size,
		textures,
	});
	if (source === null) {
		yield* animator.setFx({
			actor: payload,
			channel: "pose",
			scale: origin.size / Math.max(1, payload.size),
			x: origin.x,
			y: origin.y,
		});
		yield* startActorEnterFx({
			actor: payload,
			animator,
			delayMs,
		});
	}
	const readCurrentRoute = () => readTargetRoute(cue.targetActorId, cue.targetLocation);
	const readLiveTarget = () => {
		const route = readCurrentRoute();
		return readLiveContactPose({
			actorId: route.actorId,
			actors: actorStore.actors,
			movingActor: payload,
		});
	};
	const magneticProjector = yield* createMagneticProjectorFx({
		actor: payload,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
		surface,
		readAttraction: () => {
			const route = readCurrentRoute();
			return {
				attractedActorId: route.actorId,
				eligibleAttractionActorIds: new Set([
					route.actorId,
				]),
			};
		},
	});
	yield* chaseTargetFx({
		actor: payload,
		animator,
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			const route = readCurrentRoute();
			RendererRuntime.runSync(
				flashMotionTargetFx({
					actorStore,
					animator,
					targetActorId: route.actorId,
				}),
			);
			let settled = false;
			const settle = () => {
				if (settled) return;
				settled = true;
				magneticProjector.release();
				RendererRuntime.runSync(animator.cancelActorFx(payload));
				RendererRuntime.runSync(destroyTileActorFx(payload));
				onComplete();
			};
			RendererRuntime.runSync(
				startActorExitFx({
					actor: payload,
					animator,
					onCancel: settle,
					onComplete: settle,
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget,
		surface,
		targetLocation: cue.targetLocation,
	});
});
