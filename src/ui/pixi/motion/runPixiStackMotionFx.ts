import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileStackMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorFx } from "~/ui/pixi/actor/createPixiTileActorFx";
import { destroyPixiTileActorFx } from "~/ui/pixi/actor/destroyPixiTileActorFx";
import { updatePixiTileActorFx } from "~/ui/pixi/actor/updatePixiTileActorFx";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
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
		readonly onComplete: () => void;
		readonly onTransientCreated: (actor: PixiTileActor) => void;
		readonly origin: PixiTileActorPose;
		readonly readPalette: () => PixiScenePalette;
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
	onComplete,
	onTransientCreated,
	origin,
	readPalette,
	surface,
	target,
	textures,
}: runPixiStackMotionFx.Props) {
	const canonical = actorStore.canonicalItems.get(cue.targetActorId);
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
	transient.container.x = origin.x;
	transient.container.y = origin.y;
	yield* updatePixiTileActorFx({
		actor: transient,
		frames: application.frames,
		item: transient.item,
		palette: readPalette(),
		size: target.size,
		textures,
	});
	const durationMs = yield* readPixiTileTravelDurationMsFx({
		fromX: origin.x,
		fromY: origin.y,
		tileSize: target.size,
		toX: target.x,
		toY: target.y,
	});
	yield* animator.animateFx({
		actor: transient,
		animationKey: `motion:${cueKey}`,
		delayMs,
		durationMs,
		onComplete: () => {
			RendererRuntime.runSync(destroyPixiTileActorFx(transient));
			onComplete();
		},
		toX: target.x,
		toY: target.y,
	});
});
