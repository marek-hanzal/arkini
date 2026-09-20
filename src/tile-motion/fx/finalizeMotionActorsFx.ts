import { Effect } from "effect";

import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import { readSettleDurationMsFn } from "~/tile-motion/fn/readSettleDurationMsFn";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import { updateTileActorFx } from "~/tile-rendering/fx/updateTileActorFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { startActorExitFx } from "~/tile-rendering/fx/startActorExitFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";

export namespace finalizeMotionActorsFx {
	export interface Props {
		readonly actorIds: ReadonlySet<string>;
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly onActorSettledFn: (actor: PixiTileActor) => void;
		readonly readPaletteFn: () => PixiScenePalette;
		readonly stillClaimedActorIds: ReadonlySet<string>;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
	}
}

/** Reattaches or destroys actors released by one completed cue after lane settlement. */
export const finalizeMotionActorsFx = Effect.fn("finalizeMotionActorsFx")(function* ({
	actorIds,
	actorStore,
	animator,
	application,
	onActorSettledFn,
	readPaletteFn,
	stillClaimedActorIds,
	surface,
	textures,
}: finalizeMotionActorsFx.Props) {
	for (const actorId of actorIds) {
		if (stillClaimedActorIds.has(actorId)) continue;
		const actor = actorStore.actors.get(actorId);
		if (actor === undefined) continue;
		if (actor.container.destroyed) {
			yield* actorStore.deleteActorFx(actorId);
			onActorSettledFn(actor);
			continue;
		}
		const canonical = actorStore.canonicalItems.get(actorId);
		const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
		if (canonical === undefined || pose === null) {
			yield* actorStore.releaseActorFx(actorId);
			onActorSettledFn(actor);
			const remainingExitMs =
				actor.lifecycleTargetAlpha === 0 && actor.lifecycleTransitionStarted
					? Math.max(
							0,
							actor.lifecycleNotBeforeMs +
								actor.lifecycleDurationMs -
								performance.now(),
						)
					: undefined;
			if (
				remainingExitMs === 0 ||
				(actor.lifecycleTargetAlpha === 0 && actor.container.alpha === 0)
			) {
				yield* animator.cancelActorFx(actor);
				yield* actorStore.destroyExitingActorFx(actor);
				continue;
			}
			yield* startActorExitFx({
				actor,
				animator,
				durationMs: remainingExitMs,
				animateScale: actor.lifecycleTargetAlpha !== 0 || actor.lifecycleAnimateScale,
				onCompleteFn: () => {
					RendererRuntime.runSync(animator.cancelActorFx(actor));
					RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
				},
			});
			continue;
		}
		// A producer may still be dragged or have a newer pose writer when its output finishes.
		if (actor.dragging || (yield* animator.isChannelActiveFx(actor, "pose"))) continue;
		const displayedSize = actor.size * actor.container.scale.x;
		pose.layer.addChild(actor.container);
		yield* updateTileActorFx({
			actor,
			animator,
			frames: application.frames,
			item: canonical,
			palette: readPaletteFn(),
			size: pose.size,
			textures,
		});
		yield* animator.setFx({
			actor,
			channel: "pose",
			scale: displayedSize / Math.max(1, actor.size),
			x: actor.container.x,
			y: actor.container.y,
		});
		yield* chaseTargetFx({
			actor,
			animator,
			durationMs: readSettleDurationMsFn({
				fromX: actor.container.x,
				fromY: actor.container.y,
				tileSize: pose.size,
				toX: pose.x,
				toY: pose.y,
			}),
			fallbackTarget: pose,
			ownerKey: `motion-finalize:${actor.instanceId}`,
			readLiveTargetFn: () => {
				const latest = actorStore.canonicalItems.get(actorId);
				const latestPose =
					latest === undefined
						? null
						: RendererRuntime.runSync(surface.readActorPoseFx(latest));
				return latestPose === null
					? null
					: {
							x: latestPose.x,
							y: latestPose.y,
							scale: latestPose.size / Math.max(1, actor.size),
						};
			},
			shouldSettleFn: () => actor.dragging || !actorStore.canonicalItems.has(actorId),
			onSettledFn: () => {
				if (
					actor.dragging ||
					actor.container.destroyed ||
					actorStore.actors.get(actorId) !== actor
				)
					return;
				const latest = actorStore.canonicalItems.get(actorId);
				const latestPose =
					latest === undefined
						? null
						: RendererRuntime.runSync(surface.readActorPoseFx(latest));
				if (latestPose === null) return;
				latestPose.layer.addChild(actor.container);
				onActorSettledFn(actor);
			},
			surface,
			targetLocation: canonical.location,
		});
	}
});
