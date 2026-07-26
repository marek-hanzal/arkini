import { Effect } from "effect";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileSwapMotionCue } from "~/bridge/tile/motion/TileMotionCue";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { readPixiTileTravelDurationMsFx } from "~/ui/pixi/animation/readPixiTileTravelDurationMsFx";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

interface PixiSwapMotionLeg {
	readonly actor: PixiTileActor;
	readonly forceOrigin: PixiTileActorPose | null;
	readonly target: PixiTileActorPose;
}

export namespace runPixiSwapMotionFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly animator: PixiActorAnimator;
		readonly cue: TileSwapMotionCue;
		readonly cueKey: string;
		readonly delayMs: number;
		readonly onComplete: () => void;
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
	onComplete,
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
					},
				]),
		...(counterpart === undefined
			? []
			: [
					{
						actor: counterpart,
						forceOrigin: null,
						target: origin,
					},
				]),
	];
	if (legs.length === 0) {
		onComplete();
		return;
	}
	const pendingActorIds = new Set(legs.map(({ actor }) => actor.item.id));
	for (const leg of legs) {
		yield* animator.cancelFx(leg.actor.item.id);
		surface.transientActorLayer.addChild(leg.actor.container);
		leg.actor.container.alpha = 1;
		if (leg.forceOrigin !== null) {
			leg.actor.container.x = leg.forceOrigin.x;
			leg.actor.container.y = leg.forceOrigin.y;
		}
		const durationMs = yield* readPixiTileTravelDurationMsFx({
			fromX: leg.actor.container.x,
			fromY: leg.actor.container.y,
			tileSize: leg.target.size,
			toX: leg.target.x,
			toY: leg.target.y,
		});
		yield* animator.animateFx({
			actor: leg.actor,
			animationKey: `motion:${cueKey}:${leg.actor.item.id}`,
			delayMs,
			durationMs,
			onComplete: () => {
				if (!pendingActorIds.delete(leg.actor.item.id)) return;
				if (!leg.actor.container.destroyed) {
					const canonical = actorStore.canonicalItems.get(leg.actor.item.id);
					const currentTarget =
						canonical === undefined
							? null
							: RendererRuntime.runSync(surface.readActorPoseFx(canonical));
					const settledTarget = currentTarget ?? leg.target;
					settledTarget.layer.addChild(leg.actor.container);
					leg.actor.container.x = settledTarget.x;
					leg.actor.container.y = settledTarget.y;
				}
				if (pendingActorIds.size === 0) onComplete();
			},
			toX: leg.target.x,
			toY: leg.target.y,
		});
	}
});
