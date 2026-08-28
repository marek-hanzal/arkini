import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorExitFx } from "~/ui/pixi/animation/startPixiTileActorExitFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace finalizePixiTileMotionActorsFx {
	export interface Props {
		readonly actorIds: ReadonlySet<string>;
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly readPalette: () => PixiScenePalette;
		readonly stillClaimedActorIds: ReadonlySet<string>;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

/** Reattaches or destroys actors released by one completed cue after lane settlement. */
export const finalizePixiTileMotionActorsFx = Effect.fn("finalizePixiTileMotionActorsFx")(
	function* ({
		actorIds,
		actorStore,
		animator,
		application,
		readPalette,
		stillClaimedActorIds,
		surface,
		textures,
	}: finalizePixiTileMotionActorsFx.Props) {
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
				yield* startPixiTileActorExitFx({
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
			yield* updatePixiTileActorFx({
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
	},
);
