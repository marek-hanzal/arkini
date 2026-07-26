import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";
import { readPixiTileMotionOriginFx } from "~/ui/pixi/motion/readPixiTileMotionOriginFx";
import { runPixiSpawnMotionFx } from "~/ui/pixi/motion/runPixiSpawnMotionFx";
import { runPixiStackMotionFx } from "~/ui/pixi/motion/runPixiStackMotionFx";
import { runPixiSwapMotionFx } from "~/ui/pixi/motion/runPixiSwapMotionFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { readTileMotionStaggerDelaySecondsFx } from "~/ui/tile/motion/readTileMotionStaggerDelaySecondsFx";

export namespace runPixiTileMotionCueFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileMotionCue;
		readonly cueKey: string;
		readonly onComplete: () => void;
		readonly onTransientCreated: (actor: PixiTileActor) => void;
		readonly readHandoff: () => TileSceneHandoff | null;
		readonly readPalette: () => PixiScenePalette;
		readonly surface: PixiMainSceneSurface;
		readonly textures: PixiTextureStore;
	}
}

/** Resolves one cue and exhaustively delegates its stateless animation execution. */
export const runPixiTileMotionCueFx = Effect.fn("runPixiTileMotionCueFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	onComplete,
	onTransientCreated,
	readHandoff,
	readPalette,
	surface,
	textures,
}: runPixiTileMotionCueFx.Props) {
	const target = yield* surface.readLocationPoseFx(cue.targetLocation);
	let origin = yield* readPixiTileMotionOriginFx({
		application,
		handoff: null,
		originLocation: cue.originLocation,
		surface,
		target,
	});
	if (origin === null && target !== null) {
		origin = yield* readPixiTileMotionOriginFx({
			application,
			handoff: readHandoff(),
			originLocation: cue.originLocation,
			surface,
			target,
		});
	}
	if (origin === null || target === null) {
		match(cue)
			.with(
				{
					kind: "spawn",
				},
				(spawn) => {
					const actor = actorStore.actors.get(spawn.actorId);
					if (actor === undefined || target === null) return;
					target.layer.addChild(actor.container);
					actor.container.x = target.x;
					actor.container.y = target.y;
					actor.container.alpha = 1;
				},
			)
			.with(
				{
					kind: "stack",
				},
				() => {},
			)
			.with(
				{
					kind: "swap",
				},
				() => {},
			)
			.exhaustive();
		onComplete();
		return;
	}
	const delayMs = (yield* readTileMotionStaggerDelaySecondsFx(cue.staggerIndex)) * 1000;
	return yield* match(cue)
		.with(
			{
				kind: "spawn",
			},
			(spawn) =>
				runPixiSpawnMotionFx({
					actorStore,
					animator,
					cue: spawn,
					cueKey,
					delayMs,
					onComplete,
					origin,
					surface,
					target,
				}),
		)
		.with(
			{
				kind: "stack",
			},
			(stack) =>
				runPixiStackMotionFx({
					actorStore,
					animator,
					application,
					cue: stack,
					cueKey,
					delayMs,
					onComplete,
					onTransientCreated,
					origin,
					readPalette,
					surface,
					target,
					textures,
				}),
		)
		.with(
			{
				kind: "swap",
			},
			(swap) =>
				runPixiSwapMotionFx({
					actorStore,
					animator,
					cue: swap,
					cueKey,
					delayMs,
					onComplete,
					origin,
					surface,
					target,
				}),
		)
		.exhaustive();
});
