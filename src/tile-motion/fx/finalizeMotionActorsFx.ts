import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
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
			continue;
		}
		const canonical = actorStore.canonicalItems.get(actorId);
		const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
		if (canonical === undefined || pose === null) {
			yield* actorStore.releaseActorFx(actorId);
			yield* startActorExitFx({
				actor,
				animator,
				onCompleteFn: () => {
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
	}
});
