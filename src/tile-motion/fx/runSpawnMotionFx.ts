import { Effect } from "effect";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { TileSpawnMotionCue } from "~/tile-presentation/type/TileMotionCue";
import type { MainActorStore } from "~/tile-rendering/service/MainActorStore";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { readTravelDurationMsFn } from "~/tile-rendering/fn/readTravelDurationMsFn";
import { whenVisualReadyFx } from "~/tile-rendering/fx/whenVisualReadyFx";
import { startActorEnterFx } from "~/tile-rendering/fx/startActorEnterFx";
import type { MagneticField } from "~/tile-motion/service/MagneticField";
import { createMagneticProjectorFx } from "~/tile-motion/fx/createMagneticProjectorFx";
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
		readonly magneticField: MagneticField;
		readonly onCompleteFn: () => void;
		readonly isCueActiveFn: () => boolean;
		readonly onRevealFn: () => void;
		readonly origin: ActorPose;
		readonly surface: MainSurface;
		readonly target: ActorPose;
	}
}

/** Starts one canonical spawn actor from its resolved origin into the target surface pose. */
const startSpawnFx = Effect.fn("runSpawnMotionFx.startSpawnFx")(function* ({
	actorStore,
	animator,
	cue,
	cueKey,
	delayMs,
	magneticField,
	onCompleteFn,
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
	const magneticProjector = yield* createMagneticProjectorFx({
		actor,
		attractedActorId: null,
		eligibleAttractionActorIds: new Set(),
		magneticField,
		surface,
	});
	yield* animator.animateFx({
		actor,
		channel: "pose",
		delayMs,
		durationMs,
		ownerKey: `motion:${cueKey}`,
		onCancelFn: magneticProjector.releaseFn,
		onCompleteFn: () => {
			const settleFn = () => {
				magneticProjector.releaseFn();
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
					onPoseFn: magneticProjector.projectPoseFn,
					onSettledFn: settleFn,
					ownerKey: `motion:${cueKey}`,
					surface,
					targetLocation: cue.targetLocation,
				}),
			);
		},
		readPoseFn: (progress) => {
			const pose = poseSampler.readPoseFn(progress);
			magneticProjector.projectPoseFn(pose);
			return pose;
		},
	});
});

/** A same-slot successor waits for usable artwork before it starts the source exit and its own enter. */
export const runSpawnMotionFx = Effect.fn("runSpawnMotionFx")(function* (
	props: runSpawnMotionFx.Props,
) {
	if (props.cue.revealAtOriginExit !== true) return yield* startSpawnFx(props);
	const actor = props.actorStore.actors.get(props.cue.actorId);
	if (actor === undefined) {
		props.onCompleteFn();
		return;
	}
	let revealed = false;
	const revealFn = () => {
		if (revealed || actor.container.destroyed || !props.isCueActiveFn()) return;
		revealed = true;
		props.onRevealFn();
		const target =
			RendererRuntime.runSync(props.surface.readLocationPoseFx(props.cue.targetLocation)) ??
			props.target;
		RendererRuntime.runSync(
			startSpawnFx({
				...props,
				origin: target,
				target,
			}),
		);
	};
	for (const visual of actor.visuals)
		yield* whenVisualReadyFx({
			visual,
			// A superseded/failed visual degrades to ordinary enter rather than holding the batch forever.
			onCancelFn: revealFn,
			onReadyFn: revealFn,
		});
});
