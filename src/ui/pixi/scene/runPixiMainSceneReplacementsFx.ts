import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileReplacement } from "~/bridge/tile/motion/readCommittedTileReplacementsFx";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { readPixiReplacementAlphaAnimationKey } from "~/ui/pixi/scene/readPixiReplacementAlphaAnimationKey";

export namespace runPixiMainSceneReplacementsFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly processedKeys: Set<string>;
		readonly readPalette: () => PixiScenePalette;
		readonly replacements: ReadonlyArray<TileReplacement>;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

const retainNewestKeys = (keys: Set<string>, maximumSize = 256) => {
	while (keys.size > maximumSize) {
		const oldest = keys.values().next().value;
		if (oldest === undefined) return;
		keys.delete(oldest);
	}
};

/** Plays canonical same-slot replacement crossfades exactly once per transition key. */
export const runPixiMainSceneReplacementsFx = Effect.fn("runPixiMainSceneReplacementsFx")(
	function* ({
		actorStore,
		animator,
		application,
		processedKeys,
		readPalette,
		replacements,
		surface,
		textures,
	}: runPixiMainSceneReplacementsFx.Props) {
		for (const replacement of replacements) {
			if (processedKeys.has(replacement.key)) continue;
			const canonical = actorStore.canonicalItems.get(replacement.actorId);
			const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
			if (canonical === undefined || pose === null) continue;
			processedKeys.add(replacement.key);
			retainNewestKeys(processedKeys);
			const incoming = actorStore.actors.get(replacement.actorId);
			const outgoing = yield* createPixiTileActorFx({
				frames: application.frames,
				item: {
					...canonical,
					...replacement.previous,
					quantity: replacement.previousQuantity,
				},
				palette: readPalette(),
				textures,
			});
			outgoing.container.eventMode = "none";
			surface.transientActorLayer.addChild(outgoing.container);
			outgoing.container.x = pose.x;
			outgoing.container.y = pose.y;
			yield* updatePixiTileActorFx({
				actor: outgoing,
				frames: application.frames,
				item: outgoing.item,
				palette: readPalette(),
				size: pose.size,
				textures,
			});
			if (incoming !== undefined && !incoming.container.destroyed) {
				incoming.container.alpha = 0;
				yield* animator.animateFx({
					actor: incoming,
					animationKey: readPixiReplacementAlphaAnimationKey(replacement.actorId),
					durationMs: 280,
					toAlpha: 1,
				});
			}
			yield* animator.animateFx({
				actor: outgoing,
				animationKey: `replacement-out:${replacement.key}`,
				durationMs: 280,
				onComplete: () => {
					RendererRuntime.runSync(destroyPixiTileActorFx(outgoing));
				},
				toAlpha: 0,
			});
		}
	},
);
