import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { runInputMotionFx } from "~/tile-motion/fx/runInputMotionFx";
import { runSpawnMotionFx } from "~/tile-motion/fx/runSpawnMotionFx";
import { runStackMotionFx } from "~/tile-motion/fx/runStackMotionFx";
import { runSwapMotionFx } from "~/tile-motion/fx/runSwapMotionFx";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { TargetRoute } from "~/tile-motion/type/MotionTarget";

export namespace runMotionCueFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly application: PixiApplicationOwner;
		readonly cue: TileMotionCue;
		readonly cueKey: string;
		readonly magneticField: MagneticField;
		readonly onCompleteFn: () => void;
		readonly onSwapLegSettledFn: (actorId: string) => void;
		readonly onSwapLegStartedFn: (actorId: string) => void;
		readonly onPayloadCreatedFn: (actor: PixiTileActor) => void;
		readonly onInputRemainderRevealedFn: () => void;
		readonly readPaletteFn: () => PixiScenePalette;
		readonly readSourceSurvivesFn: () => boolean;
		readonly readTargetRouteFn: (
			actorId: string,
			location: TargetRoute["location"],
		) => TargetRoute;
		readonly surface: MainSurface;
		readonly textures: TextureStore;
	}
}

const tileMotionStaggerStepSeconds = 0.055;
const maximumTileMotionStaggerSteps = 4;
const readTileMotionStaggerDelaySecondsFn = (staggerIndex: number) =>
	Math.min(staggerIndex, maximumTileMotionStaggerSteps) * tileMotionStaggerStepSeconds;

const readMotionOriginFx = Effect.fn("runMotionCueFx.readOriginFx")(function* ({
	originActor,
	originLocation,
	surface,
}: {
	readonly originActor: PixiTileActor | null;
	readonly originLocation: TileMotionCue["originLocation"];
	readonly surface: MainSurface;
}) {
	if (originActor !== null && !originActor.container.destroyed) {
		const scale = originActor.container.scale.x;
		return {
			layer: originActor.container.parent ?? surface.transientActorLayer,
			size: originActor.size * scale,
			x:
				originActor.container.x -
				originActor.container.pivot.x * scale +
				originActor.offsetLayer.x * scale,
			y:
				originActor.container.y -
				originActor.container.pivot.y * scale +
				originActor.offsetLayer.y * scale,
		};
	}
	return yield* surface.readLocationPoseFx(originLocation);
});

/** Resolves one cue and exhaustively delegates its stateless animation execution. */
export const runMotionCueFx = Effect.fn("runMotionCueFx")(function* ({
	actorStore,
	animator,
	application,
	cue,
	cueKey,
	magneticField,
	onCompleteFn,
	onSwapLegSettledFn,
	onSwapLegStartedFn,
	onPayloadCreatedFn,
	onInputRemainderRevealedFn,
	readPaletteFn,
	readSourceSurvivesFn,
	readTargetRouteFn,
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
					const delayMs = readTileMotionStaggerDelaySecondsFn(cue.staggerIndex) * 1000;
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
									onCompleteFn,
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
									onCompleteFn,
									onPayloadCreatedFn,
									origin,
									readPaletteFn,
									readTargetRouteFn,
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
									onCompleteFn,
									onRemainderRevealedFn: onInputRemainderRevealedFn,
									onPayloadCreatedFn,
									origin,
									readPaletteFn,
									readSourceSurvivesFn,
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
									onCompleteFn,
									onSwapLegSettledFn,
									onSwapLegStartedFn,
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
					onCompleteFn();
				}),
		)
		.with(
			{
				target: null,
			},
			() => Effect.sync(onCompleteFn),
		)
		.exhaustive();
});
