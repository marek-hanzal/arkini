import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileStackMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import { restorePixiTileActorRemovalFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorRemovalFeedbackFx";
import { startPixiTileActorVanishFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorVanishFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { flashPixiMotionTargetFx } from "~/ui/pixi/motion/flashPixiMotionTargetFx";
import { projectPixiTileMotionItem } from "~/ui/pixi/motion/projectPixiTileMotionItem";
import { readPixiLiveActorContactPose } from "~/ui/pixi/motion/readPixiLiveActorContactPose";
import type { PixiTileMotionTargetRoute } from "~/ui/pixi/motion/PixiTileMotionTargetRoute";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export namespace runPixiStackMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileStackMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: PixiTileMagneticField;
		readonly onComplete: () => void;
		readonly onPayloadCreated: (actor: PixiTileActor) => void;
		readonly origin: PixiTileActorPose;
		readonly readPalette: () => PixiScenePalette;
		readonly readTargetRoute: (
			actorId: string,
			location: PixiTileMotionTargetRoute["location"],
		) => PixiTileMotionTargetRoute;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
		readonly textures: PixiTextureStore;
	}
}

/** Animates a consumed source actor or an identity-free produced stack payload. */
export const runPixiStackMotionFx = Effect.fn("runPixiStackMotionFx")(function* ({
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
}: runPixiStackMotionFx.Props) {
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
		(yield* createPixiTileActorFx({
			frames: application.frames,
			item: projectPixiTileMotionItem(
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
		yield* restorePixiTileActorRemovalFeedbackFx({
			actor: source,
			animator,
		});
	}
	payload.container.eventMode = "none";
	if (source === null) onPayloadCreated(payload);
	surface.transientActorLayer.addChild(payload.container);
	yield* updatePixiTileActorFx({
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
			alpha: 0,
			channel: "lifecycle-opacity",
		});
		yield* animator.setFx({
			actor: payload,
			channel: "pose",
			scale: origin.size / Math.max(1, payload.size),
			x: origin.x,
			y: origin.y,
		});
		yield* startPixiTileActorFadeInFx({
			actor: payload,
			animator,
			delayMs,
		});
	}
	const readCurrentRoute = () => readTargetRoute(cue.targetActorId, cue.targetLocation);
	const readLiveTarget = () => {
		const route = readCurrentRoute();
		return readPixiLiveActorContactPose({
			actorId: route.actorId,
			actors: actorStore.actors,
			movingActor: payload,
		});
	};
	const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
		actor: payload,
		attractedActorId: cue.targetActorId,
		eligibleAttractionActorIds: new Set([
			cue.targetActorId,
		]),
		magneticField,
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
	yield* chasePixiTileMotionTargetFx({
		actor: payload,
		animator,
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			const route = readCurrentRoute();
			RendererRuntime.runSync(
				flashPixiMotionTargetFx({
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
				RendererRuntime.runSync(destroyPixiTileActorFx(payload));
				onComplete();
			};
			RendererRuntime.runSync(
				startPixiTileActorVanishFeedbackFx({
					actor: payload,
					animator,
					onCancel: settle,
					onComplete: settle,
				}),
			);
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget,
		settleWithinTileRatio: 0.5,
		surface,
		targetLocation: cue.targetLocation,
	});
});
