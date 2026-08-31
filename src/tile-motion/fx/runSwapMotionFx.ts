import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileSwapMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { readSettleDurationMsFn } from "~/tile-motion/fn/readSettleDurationMsFn";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
import { createMotionPoseSamplerFx } from "~/tile-motion/fx/createMotionPoseSamplerFx";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

interface SwapLeg {
	readonly actor: PixiTileActor;
	readonly forceOrigin: ActorPose | null;
	readonly target: ActorPose;
	readonly targetLocation: TileSwapMotionCue["targetLocation"];
}

export namespace runSwapMotionFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly cue: TileSwapMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly magneticField: MagneticField;
		readonly onCompleteFn: () => void;
		readonly onSwapLegSettledFn: (actorId: string) => void;
		readonly onSwapLegStartedFn: (actorId: string) => void;
		readonly origin: ActorPose;
		readonly surface: MainSurface;
		readonly target: ActorPose;
	}
}

/** Animates both available swap legs and settles only after each unique leg completes. */
export const runSwapMotionFx = Effect.fn("runSwapMotionFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onCompleteFn,
	onSwapLegSettledFn,
	onSwapLegStartedFn,
	origin,
	surface,
	target,
}: runSwapMotionFx.Props) {
	const exchanged = actorStore.actors.get(cue.actorId);
	const counterpart = actorStore.actors.get(cue.counterpartActorId);
	const legs: ReadonlyArray<SwapLeg> = [
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
		onCompleteFn();
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
		const durationMs = readSettleDurationMsFn({
			fromX: leg.actor.container.x,
			fromY: leg.actor.container.y,
			tileSize: leg.target.size,
			toX: leg.target.x,
			toY: leg.target.y,
		});
		const poseSampler = yield* createMotionPoseSamplerFx({
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
		const magneticProjector = yield* createMagneticProjectorFx({
			actor: leg.actor,
			attractedActorId: null,
			eligibleAttractionActorIds: new Set([
				counterpartActorId,
			]),
			magneticField,
			surface,
		});
		onSwapLegStartedFn(leg.actor.item.id);
		yield* animator.animateFx({
			actor: leg.actor,
			channel: "pose",
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
			delayMs,
			durationMs,
			ownerKey: `motion:${cueKey}:${leg.actor.item.id}`,
			onCancelFn: magneticProjector.releaseFn,
			onCompleteFn: () => {
				const settleFn = () => {
					if (!pendingActorIds.delete(leg.actor.item.id)) return;
					magneticProjector.releaseFn();
					if (!leg.actor.container.destroyed) {
						const canonical = actorStore.canonicalItems.get(leg.actor.item.id);
						const currentTarget =
							canonical === undefined
								? null
								: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
						const settledTarget = currentTarget ?? leg.target;
						settledTarget.layer.addChild(leg.actor.container);
					}
					onSwapLegSettledFn(leg.actor.item.id);
					if (pendingActorIds.size === 0) onCompleteFn();
				};
				if (!poseSampler.needsCompletionSettleFn()) {
					settleFn();
					return;
				}
				RendererRuntime.runSync(
					chaseTargetFx({
						actor: leg.actor,
						animator,
						fallbackTarget: leg.target,
						onPoseFn: magneticProjector.projectPoseFn,
						onSettledFn: settleFn,
						ownerKey: `motion:${cueKey}:${leg.actor.item.id}`,
						surface,
						targetLocation: leg.targetLocation,
					}),
				);
			},
			readPoseFn: (progress) => {
				const pose = poseSampler.readPoseFn(progress);
				magneticProjector.projectPoseFn(pose);
				return pose;
			},
		});
	}
});
