import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import { updateTileActorFx } from "~/ui/pixi/actor/updateTileActorFx";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { startActorExitFx } from "~/ui/pixi/animation/startActorExitFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";

export namespace finalizeMotionActorsFx {
	export interface Props {
		readonly actorIds: ReadonlySet<string>;
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly readPalette: () => PixiScenePalette;
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
	readPalette,
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
			continue;
		}
		const canonical = actorStore.canonicalItems.get(actorId);
		const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
		if (canonical === undefined || pose === null) {
			yield* actorStore.releaseActorFx(actorId);
			yield* startActorExitFx({
				actor,
				animator,
				onComplete: () => {
					RendererRuntime.runSync(animator.cancelActorFx(actor));
					RendererRuntime.runSync(actorStore.destroyExitingActorFx(actor));
				},
			});
			continue;
		}
		const displayedSize = actor.size * actor.container.scale.x;
		pose.layer.addChild(actor.container);
		yield* updateTileActorFx({
			actor,
			animator,
			frames: application.frames,
			item: canonical,
			palette: readPalette(),
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
	}
});
