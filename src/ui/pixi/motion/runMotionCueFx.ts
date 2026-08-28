import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { ActorAnimator } from "~/ui/pixi/animation/ActorAnimator";
import { startActorEnterFx } from "~/ui/pixi/animation/startActorEnterFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { MagneticField } from "~/ui/pixi/magnet/MagneticField";
import { readMotionOriginFx } from "~/ui/pixi/motion/readMotionOriginFx";
import { runInputMotionFx } from "~/ui/pixi/motion/runInputMotionFx";
import { runSpawnMotionFx } from "~/ui/pixi/motion/runSpawnMotionFx";
import { runStackMotionFx } from "~/ui/pixi/motion/runStackMotionFx";
import { runSwapMotionFx } from "~/ui/pixi/motion/runSwapMotionFx";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";
import { readTileMotionStaggerDelaySecondsFx } from "~/ui/tile/motion/readTileMotionStaggerDelaySecondsFx";
import type { TargetRoute } from "~/ui/pixi/motion/MotionTarget";

export namespace runMotionCueFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileMotionCue;
		readonly cueKey: string;
		readonly magneticField: MagneticField;
		readonly onComplete: () => void;
		readonly onSwapLegSettled: (actorId: string) => void;
		readonly onSwapLegStarted: (actorId: string) => void;
		readonly onPayloadCreated: (actor: PixiTileActor) => void;
		readonly onInputRemainderRevealed: () => void;
		readonly readPalette: () => PixiScenePalette;
		readonly readSourceSurvives: () => boolean;
		readonly readTargetRoute: (
			actorId: string,
			location: TargetRoute["location"],
		) => TargetRoute;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
	}
}

/** Resolves one cue and exhaustively delegates its stateless animation execution. */
export const runMotionCueFx = Effect.fn("runMotionCueFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	magneticField,
	onComplete,
	onSwapLegSettled,
	onSwapLegStarted,
	onPayloadCreated,
	onInputRemainderRevealed,
	readPalette,
	readSourceSurvives,
	readTargetRoute,
	surface,
	textures,
}: runMotionCueFx.Props) {
	const target = yield* surface.readLocationPoseFx(cue.targetLocation);
	const originActor = actorStore.actors.get(cue.originActorId) ?? null;
	const origin = yield* readMotionOriginFx({
		originActor,
		originLocation: cue.originLocation,
		surface,
	});
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
								runSpawnMotionFx({
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
								runStackMotionFx({
									actorStore,
									animator,
									application,
									cue: stack,
									cueKey,
									delayMs,
									magneticField,
									onComplete,
									onPayloadCreated,
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
								runInputMotionFx({
									actorStore,
									animator,
									application,
									cue: input,
									cueKey,
									delayMs,
									magneticField,
									onComplete,
									onRemainderRevealed: onInputRemainderRevealed,
									onPayloadCreated,
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
								runSwapMotionFx({
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
									startActorEnterFx({
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
