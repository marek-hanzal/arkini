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
import { startPixiTileActorVanishFeedbackFx } from "~/ui/pixi/animation/startPixiTileActorVanishFeedbackFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { chasePixiTileMotionTargetFx } from "~/ui/pixi/motion/chasePixiTileMotionTargetFx";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { flashPixiMotionTargetFx } from "~/ui/pixi/motion/flashPixiMotionTargetFx";
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
		readonly onMagneticSourceAcquired: (actorId: string) => void;
		readonly onMagneticSourceReleased: (actorId: string) => void;
		readonly onTransientCreated: (actor: PixiTileActor) => void;
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

/** Creates and animates one transient stack payload without owning lane settlement. */
export const runPixiStackMotionFx = Effect.fn("runPixiStackMotionFx")(function* ({
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
	const transient = yield* createPixiTileActorFx({
		frames: application.frames,
		item: {
			...canonical,
			id: `motion:${cueKey}`,
			quantity: cue.quantity,
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
		alpha: 0,
		channel: "lifecycle-opacity",
	});
	yield* animator.setFx({
		actor: transient,
		channel: "pose",
		scale: origin.size / Math.max(1, transient.size),
		x: origin.x,
		y: origin.y,
	});
	yield* startPixiTileActorFadeInFx({
		actor: transient,
		animator,
		delayMs,
	});
	const readCurrentRoute = () => readTargetRoute(cue.targetActorId, cue.targetLocation);
	const readLiveTarget = () => {
		const route = readCurrentRoute();
		return readPixiLiveActorContactPose({
			actorId: route.actorId,
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
		onAcquired: onMagneticSourceAcquired,
		onReleased: onMagneticSourceReleased,
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
		actor: transient,
		animator,
		delayMs,
		fallbackTarget: target,
		onPose: magneticProjector.projectPose,
		onSettled: () => {
			magneticProjector.release();
			const route = readCurrentRoute();
			RendererRuntime.runSync(
				flashPixiMotionTargetFx({
					actorStore,
					animator,
					targetActorId: route.actorId,
				}),
			);
			if (route.redirected) {
				let settled = false;
				const settle = () => {
					if (settled) return;
					settled = true;
					onComplete();
				};
				RendererRuntime.runSync(
					startPixiTileActorVanishFeedbackFx({
						actor: transient,
						animator,
						onCancel: settle,
						onComplete: settle,
					}),
				);
				return;
			}
			RendererRuntime.runSync(animator.cancelActorFx(transient));
			RendererRuntime.runSync(destroyPixiTileActorFx(transient));
			onComplete();
		},
		ownerKey: `motion:${cueKey}`,
		readLiveTarget,
		surface,
		targetLocation: cue.targetLocation,
	});
});
