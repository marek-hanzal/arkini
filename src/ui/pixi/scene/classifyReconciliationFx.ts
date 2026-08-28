import { Effect } from "effect";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import type { PixiTileActorPose } from "~/ui/pixi/scene/PixiTileActorPose";

export interface PixiMainSceneVisibleActor {
	readonly item: TileActorItem;
	readonly pose: PixiTileActorPose;
}

export type PixiMainSceneActorArrival =
	| {
			readonly kind: "add";
			readonly visible: PixiMainSceneVisibleActor;
	  }
	| {
			readonly kind: "update";
			readonly visible: PixiMainSceneVisibleActor;
	  };

export type PixiMainSceneActorDeparture =
	| {
			readonly actorId: string;
			readonly kind: "remove-immediately";
	  }
	| {
			readonly actorId: string;
			readonly feedbackCues: ReadonlyArray<TileActorFeedbackCue>;
			readonly kind: "release";
			readonly style: "default" | "feedback" | "feedback-particles";
	  }
	| {
			readonly actorId: string;
			readonly kind: "release-hidden";
	  };

export interface PixiMainSceneReconciliationPlan {
	readonly arrivals: ReadonlyArray<PixiMainSceneActorArrival>;
	readonly departures: ReadonlyArray<PixiMainSceneActorDeparture>;
}

export namespace classifyReconciliationFx {
	export interface Props {
		readonly actorIds: Iterable<string>;
		readonly deliveryRetainedActorIds: ReadonlySet<string>;
		readonly feedbackCues: ReadonlyArray<TileActorFeedbackCue>;
		readonly hiddenActorIds: ReadonlySet<string>;
		readonly inventoryActorIds: ReadonlySet<string>;
		readonly motionRetainedActorIds: ReadonlySet<string>;
		readonly pendingActorIds: ReadonlySet<string>;
		readonly visibleActors: ReadonlyMap<string, PixiMainSceneVisibleActor>;
	}
}

/**
 * Classifies one fully-read presentation snapshot without mutating retained actors or allocating
 * visual generations. The reconciler remains the sole owner that applies this ordered plan.
 */
export const classifyReconciliationFx = Effect.fnUntraced(function* ({
	actorIds,
	deliveryRetainedActorIds,
	feedbackCues,
	hiddenActorIds,
	inventoryActorIds,
	motionRetainedActorIds,
	pendingActorIds,
	visibleActors,
}: classifyReconciliationFx.Props) {
	const currentActorIds = [
		...actorIds,
	];
	const currentActorIdSet = new Set(currentActorIds);
	const arrivals = [
		...visibleActors.entries(),
	].map(
		([actorId, visible]): PixiMainSceneActorArrival => ({
			kind: currentActorIdSet.has(actorId) ? "update" : "add",
			visible,
		}),
	);
	const visibleActorIds = new Set(visibleActors.keys());
	const leavingFeedbackActorIds = new Set(
		feedbackCues
			.filter(({ actorId }) => !visibleActorIds.has(actorId))
			.map(({ actorId }) => actorId),
	);
	const departures: PixiMainSceneActorDeparture[] = [];
	for (const actorId of currentActorIds) {
		if (visibleActors.has(actorId)) continue;
		if (pendingActorIds.has(actorId)) continue;
		if (hiddenActorIds.has(actorId)) {
			departures.push({
				actorId,
				kind: "release-hidden",
			});
			continue;
		}
		if (inventoryActorIds.has(actorId)) {
			departures.push({
				actorId,
				kind: "remove-immediately",
			});
			continue;
		}
		if (deliveryRetainedActorIds.has(actorId)) continue;
		if (motionRetainedActorIds.has(actorId)) continue;
		const exitFeedbackCues = feedbackCues.filter(
			({ actorId: feedbackActorId, kind }) =>
				feedbackActorId === actorId && kind !== "consume-source",
		);
		departures.push({
			actorId,
			feedbackCues: exitFeedbackCues,
			kind: "release",
			style:
				exitFeedbackCues.length > 0
					? "feedback-particles"
					: leavingFeedbackActorIds.has(actorId)
						? "feedback"
						: "default",
		});
	}
	return {
		arrivals,
		departures,
	};
});
