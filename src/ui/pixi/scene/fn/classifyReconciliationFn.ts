import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { TileActorFeedbackCue } from "~/tile-presentation/type/TileActorFeedbackCue";
import type { ActorPose } from "~/ui/pixi/scene/ActorPose";

export interface VisibleActor {
	readonly item: TileActorItem;
	readonly pose: ActorPose;
}

export type ActorArrival =
	| {
			readonly kind: "add";
			readonly visible: VisibleActor;
	  }
	| {
			readonly kind: "update";
			readonly visible: VisibleActor;
	  };

export type ActorDeparture =
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

export interface ReconciliationPlan {
	readonly arrivals: ReadonlyArray<ActorArrival>;
	readonly departures: ReadonlyArray<ActorDeparture>;
}

export namespace classifyReconciliationFn {
	export interface Props {
		readonly actorIds: Iterable<string>;
		readonly deliveryRetainedActorIds: ReadonlySet<string>;
		readonly feedbackCues: ReadonlyArray<TileActorFeedbackCue>;
		readonly hiddenActorIds: ReadonlySet<string>;
		readonly inventoryActorIds: ReadonlySet<string>;
		readonly motionRetainedActorIds: ReadonlySet<string>;
		readonly pendingActorIds: ReadonlySet<string>;
		readonly visibleActors: ReadonlyMap<string, VisibleActor>;
	}
}

/**
 * Classifies one fully-read presentation snapshot without mutating retained actors or allocating
 * visual generations. The reconciler remains the sole owner that applies this ordered plan.
 */
export const classifyReconciliationFn = ({
	actorIds,
	deliveryRetainedActorIds,
	feedbackCues,
	hiddenActorIds,
	inventoryActorIds,
	motionRetainedActorIds,
	pendingActorIds,
	visibleActors,
}: classifyReconciliationFn.Props) => {
	const currentActorIds = [
		...actorIds,
	];
	const currentActorIdSet = new Set(currentActorIds);
	const arrivals = [
		...visibleActors.entries(),
	].map(
		([actorId, visible]): ActorArrival => ({
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
	const departures: ActorDeparture[] = [];
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
};
