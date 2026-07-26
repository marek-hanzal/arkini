import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileSwapMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiTileMagneticField } from "~/ui/pixi/magnet/PixiTileMagneticField";
import { createPixiTileMotionMagneticProjectorFx } from "~/ui/pixi/motion/createPixiTileMotionMagneticProjectorFx";
import { createPixiTileMotionPoseSamplerFx } from "~/ui/pixi/motion/createPixiTileMotionPoseSamplerFx";
import { settlePixiTileMotionActorFx } from "~/ui/pixi/motion/settlePixiTileMotionActorFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

interface PixiSwapMotionLeg {
	readonly actor: PixiTileActor;
	readonly forceOrigin: PixiTileActorPose | null;
	readonly target: PixiTileActorPose;
	readonly targetLocation: TileSwapMotionCue["targetLocation"];
}

export namespace runPixiSwapMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cue: TileSwapMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: PixiTileMagneticField;
		readonly onComplete: () => void;
		readonly onMagneticSourceAcquired: (actorId: string) => void;
		readonly onMagneticSourceReleased: (actorId: string) => void;
		readonly onSwapLegSettled: (actorId: string) => void;
		readonly onSwapLegStarted: (actorId: string) => void;
		readonly origin: PixiTileActorPose;
		readonly surface: PixiMainSceneSurface;
		readonly target: PixiTileActorPose;
	}
}

/** Animates both available swap legs and settles only after each unique leg completes. */
export const runPixiSwapMotionFx = Effect.fn("runPixiSwapMotionFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onComplete,
	onMagneticSourceAcquired,
	onMagneticSourceReleased,
	onSwapLegSettled,
	onSwapLegStarted,
	origin,
	surface,
	target,
}: runPixiSwapMotionFx.Props) {
	const exchanged = actorStore.actors.get(cue.actorId);
	const counterpart = actorStore.actors.get(cue.counterpartActorId);
	const legs: ReadonlyArray<PixiSwapMotionLeg> = [
		...(exchanged === undefined
			? []
			: [
					{
						actor: exchanged,
						forceOrigin: origin,
						target,
						targetLocation: cue.targetLocation,
					},
				]),
		...(counterpart === undefined
			? []
			: [
					{
						actor: counterpart,
						forceOrigin: null,
						target: origin,
						targetLocation: cue.originLocation,
					},
				]),
	];
	if (legs.length === 0) {
		onComplete();
		return;
	}
	const pendingActorIds = new Set(legs.map(({ actor }) => actor.item.id));
	for (const leg of legs) {
		surface.transientActorLayer.addChild(leg.actor.container);
		if (leg.forceOrigin !== null) {
			yield* animator.setFx({
				actor: leg.actor,
				channel: "pose",
				scale: leg.forceOrigin.size / Math.max(1, leg.actor.size),
				x: leg.forceOrigin.x,
				y: leg.forceOrigin.y,
			});
		}
		const durationMs = yield* readPixiTileTravelDurationMsFx({
			fromX: leg.actor.container.x,
			fromY: leg.actor.container.y,
			tileSize: leg.target.size,
			toX: leg.target.x,
			toY: leg.target.y,
		});
		const poseSampler = yield* createPixiTileMotionPoseSamplerFx({
			actorBaseSize: leg.actor.size,
			from: {
				scale: leg.actor.container.scale.x,
				x: leg.actor.container.x,
				y: leg.actor.container.y,
			},
			surface,
			target: leg.target,
			targetLocation: leg.targetLocation,
		});
		const counterpartActorId =
			leg.actor.item.id === cue.actorId ? cue.counterpartActorId : cue.actorId;
		const magneticProjector = yield* createPixiTileMotionMagneticProjectorFx({
			actor: leg.actor,
			attractedActorId: null,
			eligibleAttractionActorIds: new Set([
				counterpartActorId,
			]),
			magneticField,
			onAcquired: onMagneticSourceAcquired,
			onReleased: onMagneticSourceReleased,
		});
		onSwapLegStarted(leg.actor.item.id);
		yield* animator.animateFx({
			actor: leg.actor,
			channel: "pose",
			delayMs,
			durationMs,
			ownerKey: `motion:${cueKey}:${leg.actor.item.id}`,
			onComplete: () => {
				const settle = () => {
					if (!pendingActorIds.delete(leg.actor.item.id)) return;
					magneticProjector.release();
					if (!leg.actor.container.destroyed) {
						const canonical = actorStore.canonicalItems.get(leg.actor.item.id);
						const currentTarget =
							canonical === undefined
								? null
								: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
						const settledTarget = currentTarget ?? leg.target;
						settledTarget.layer.addChild(leg.actor.container);
					}
					onSwapLegSettled(leg.actor.item.id);
					if (pendingActorIds.size === 0) onComplete();
				};
				if (!poseSampler.needsCompletionSettle()) {
					settle();
					return;
				}
				RendererRuntime.runSync(
					settlePixiTileMotionActorFx({
						actor: leg.actor,
						animator,
						fallbackTarget: leg.target,
						onPose: magneticProjector.projectPose,
						onSettled: settle,
						ownerKey: `motion:${cueKey}:${leg.actor.item.id}`,
						surface,
						targetLocation: leg.targetLocation,
					}),
				);
			},
			readPose: (progress) => {
				const pose = poseSampler.readPose(progress);
				magneticProjector.projectPose(pose);
				return pose;
			},
		});
	}
});
