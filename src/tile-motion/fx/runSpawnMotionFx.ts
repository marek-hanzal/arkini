import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileSpawnMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";
import { prepareActorBirthFx } from "~/tile-rendering/fx/prepareActorBirthFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import { createMotionPoseSamplerFx } from "~/tile-motion/fx/createMotionPoseSamplerFx";
import { chaseTargetFx } from "~/tile-motion/fx/chaseTargetFx";
import type { MainSurface } from "~/game-scene/service/MainSurface";
import type { ActorPose } from "~/game-scene/type/ActorPose";

export namespace runSpawnMotionFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly animator: ActorAnimator;
		readonly cue: TileSpawnMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly onCompleteFn: () => void;
		readonly isCueActiveFn: () => boolean;
		readonly origin: ActorPose;
		readonly surface: MainSurface;
		readonly target: ActorPose;
	}
}

/** Starts one canonical spawn actor from its resolved origin into the target surface pose. */
export const runSpawnMotionFx = Effect.fn("runSpawnMotionFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	onCompleteFn,
	isCueActiveFn,
	origin,
	surface,
	target,
}: runSpawnMotionFx.Props) {
	const actor = actorStore.actors.get(cue.actorId);
	if (actor === undefined) {
		onCompleteFn();
		return;
	}
	surface.transientActorLayer.addChild(actor.container);
	yield* animator.setFx({
		actor,
		channel: "pose",
		scale: origin.size / Math.max(1, actor.size),
		x: origin.x,
		y: origin.y,
	});
	yield* prepareActorBirthFx({
		actor,
		actorStore,
		animator,
		pose: origin,
		transientActorLayer: surface.transientActorLayer,
	});
	yield* startActorEnterFx({
		actor,
		animator,
		delayMs,
	});
	const durationMs = readTravelDurationMsFn({
		fromX: origin.x,
		fromY: origin.y,
		tileSize: target.size,
		toX: target.x,
		toY: target.y,
	});
	const poseSampler = yield* createMotionPoseSamplerFx({
		actorBaseSize: actor.size,
		from: {
			scale: actor.container.scale.x,
			x: actor.container.x,
			y: actor.container.y,
		},
		surface,
		target,
		targetLocation: cue.targetLocation,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		delayMs,
		durationMs,
		ownerKey: `motion:${cueKey}`,
		onCompleteFn: () => {
			if (!isCueActiveFn()) return;
			const settleFn = () => {
				if (!isCueActiveFn()) return;
				const currentTarget =
					RendererRuntime.runSync(surface.readLocationPoseFx(cue.targetLocation)) ??
					target;
				if (!actor.container.destroyed) {
					currentTarget.layer.addChild(actor.container);
				}
				onCompleteFn();
			};
			if (!poseSampler.needsCompletionSettleFn()) {
				settleFn();
				return;
			}
			RendererRuntime.runSync(
				chaseTargetFx({
					actor,
					animator,
					fallbackTarget: target,
					onSettledFn: settleFn,
					ownerKey: `motion:${cueKey}`,
					surface,
					targetLocation: cue.targetLocation,
				}),
			);
		},
		readPoseFn: poseSampler.readPoseFn,
	});
});
