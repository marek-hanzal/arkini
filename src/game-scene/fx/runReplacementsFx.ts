import { Effect } from "effect";

import type { TileReplacement } from "~/tile-presentation/fx/readCommittedTileReplacementsFx";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import {
	visualCrossfadeDurationMs,
	transitionActorVisualFx,
} from "~/tile-rendering/fx/transitionActorVisualFx";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";

interface RunReplacementsProps {
	readonly actorStore: MainActorStore;
	readonly animator: ActorAnimator;
	readonly application: PixiApplicationOwner;
	readonly processedKeys: Set<string>;
	readonly readPalette: () => PixiScenePalette;
	readonly replacements: ReadonlyArray<TileReplacement>;
	readonly surface: MainSurface;
	readonly textures: TextureStore;
}

const retainNewestKeys = (keys: Set<string>, maximumSize = 256) => {
	while (keys.size > maximumSize) {
		const oldest = keys.values().next().value;
		if (oldest === undefined) return;
		keys.delete(oldest);
	}
};

/**
 * Blends complete visual slots inside one canonical actor.
 *
 * The current renderable revision is never cleared or reconstructed. A pending revision owns its
 * own texture generation and only joins the blend after its complete face is ready.
 */
export const runReplacementsFx = Effect.fn("runReplacementsFx")(function* ({
	actorStore,
	animator,
	application,
	processedKeys,
	readPalette,
	replacements,
	surface,
	textures,
}: RunReplacementsProps) {
	for (const replacement of replacements) {
		if (processedKeys.has(replacement.key)) continue;
		const actor = actorStore.actors.get(replacement.actorId);
		const canonical = actorStore.canonicalItems.get(replacement.actorId);
		const pose = canonical === undefined ? null : yield* surface.readActorPoseFx(canonical);
		if (
			actor === undefined ||
			actor.container.destroyed ||
			canonical === undefined ||
			pose === null
		) {
			continue;
		}
		processedKeys.add(replacement.key);
		retainNewestKeys(processedKeys);
		yield* transitionActorVisualFx({
			actor,
			animator,
			durationMs: visualCrossfadeDurationMs,
			frames: application.frames,
			item: canonical,
			onDiscard: () => processedKeys.delete(replacement.key),
			ownerKey: `replacement:${replacement.key}`,
			palette: readPalette(),
			size: pose.size,
			textures,
		});
	}
});
