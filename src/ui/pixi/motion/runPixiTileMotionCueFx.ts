import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { startPixiTileActorFadeInFx } from "~/ui/pixi/animation/startPixiTileActorFadeInFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { TileSceneHandoff } from "~/ui/pixi/handoff/TileSceneHandoff";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { readPixiTileMotionOriginFx } from "~/ui/pixi/motion/readPixiTileMotionOriginFx";
import { runPixiInputMotionFx } from "~/ui/pixi/motion/runPixiInputMotionFx";
import { runPixiSpawnMotionFx } from "~/ui/pixi/motion/runPixiSpawnMotionFx";
import { runPixiStackMotionFx } from "~/ui/pixi/motion/runPixiStackMotionFx";
import { runPixiSwapMotionFx } from "~/ui/pixi/motion/runPixiSwapMotionFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import { readTileMotionStaggerDelaySecondsFx } from "~/ui/tile/motion/readTileMotionStaggerDelaySecondsFx";
import type { PixiTileMotionTargetRoute } from "~/ui/pixi/motion/PixiTileMotionTargetRoute";

export namespace runPixiTileMotionCueFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileMotionCue;
		readonly cueKey: string;
		readonly magneticField: PixiTileMagneticField;
		readonly onComplete: () => void;
		readonly onSwapLegSettled: (actorId: string) => void;
		readonly onSwapLegStarted: (actorId: string) => void;
		readonly onTransientCreated: (actor: PixiTileActor) => void;
		readonly readHandoff: () => TileSceneHandoff | null;
		readonly readPalette: () => PixiScenePalette;
		readonly readSourceSurvives: () => boolean;
		readonly readTargetRoute: (
			actorId: string,
			location: PixiTileMotionTargetRoute["location"],
		) => PixiTileMotionTargetRoute;
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
	magneticField,
	onComplete,
	onSwapLegSettled,
	onSwapLegStarted,
	onTransientCreated,
	readHandoff,
	readPalette,
	readSourceSurvives,
	readTargetRoute,
	surface,
	textures,
}: runPixiTileMotionCueFx.Props) {
	const target = yield* surface.readLocationPoseFx(cue.targetLocation);
	const originActor = actorStore.actors.get(cue.originActorId) ?? null;
	let origin = yield* readPixiTileMotionOriginFx({
		application,
		handoff: null,
		originActor,
		originLocation: cue.originLocation,
		surface,
		target,
	});
	if (origin === null && target !== null) {
		origin = yield* readPixiTileMotionOriginFx({
			application,
			handoff: readHandoff(),
			originActor,
			originLocation: cue.originLocation,
			surface,
			target,
		});
	}
	return yield* match({
		origin,
		target,
	})
		.with(
			{
				origin: P.nonNullable,
				target: P.nonNullable,
			},
			({ origin, target }) =>
				Effect.gen(function* () {
					const delayMs =
						(yield* readTileMotionStaggerDelaySecondsFx(cue.staggerIndex)) * 1000;
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
									magneticField,
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
									magneticField,
									onComplete,
									onTransientCreated,
									origin,
									readPalette,
									readTargetRoute,
									surface,
									target,
									textures,
								}),
						)
						.with(
							{
								kind: "input",
							},
							(input) =>
								runPixiInputMotionFx({
									actorStore,
									animator,
									application,
									cue: input,
									cueKey,
									delayMs,
									magneticField,
									onComplete,
									onTransientCreated,
									origin,
									readPalette,
									readSourceSurvives,
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
									magneticField,
									onComplete,
									onSwapLegSettled,
									onSwapLegStarted,
									origin,
									surface,
									target,
								}),
						)
						.exhaustive();
				}),
		)
		.with(
			{
				origin: null,
				target: P.nonNullable,
			},
			({ target }) =>
				Effect.sync(() => {
					match(cue)
						.with(
							{
								kind: "spawn",
							},
							(spawn) => {
								const actor = actorStore.actors.get(spawn.actorId);
								if (actor === undefined) return;
								target.layer.addChild(actor.container);
								RendererRuntime.runSync(
									animator.setFx({
										actor,
										channel: "pose",
										scale: 1,
										x: target.x,
										y: target.y,
									}),
								);
								RendererRuntime.runSync(
									startPixiTileActorFadeInFx({
										actor,
										animator,
										delayMs: 0,
									}),
								);
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
								kind: "input",
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
				}),
		)
		.with(
			{
				target: null,
			},
			() => Effect.sync(onComplete),
		)
		.exhaustive();
});
