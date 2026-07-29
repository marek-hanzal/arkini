import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { isSameTileActorLocation } from "~/bridge/tile/isSameTileActorLocation";
import type { TileActorFeedbackCue } from "~/bridge/tile/feedback/TileActorFeedbackCue";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { readPixiTileActorCrowdAlpha } from "~/ui/pixi/actor/readPixiTileActorCrowdAlpha";
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

export interface PixiMainSceneActorUpdatePlan {
	readonly activityEffect: "start" | "stop" | null;
	readonly crowdAlpha: number | null;
	readonly item:
		| {
				readonly kind: "assign";
		  }
		| {
				readonly kind: "progress";
		  }
		| {
				readonly kind: "visual";
				readonly preserveVisual: boolean;
				readonly size: number;
		  };
	readonly pose:
		| {
				readonly kind: "owned";
		  }
		| {
				readonly kind: "place";
		  }
		| {
				readonly directLanding: boolean;
				readonly kind: "travel";
				readonly scaleBeforeTravel: number | null;
		  };
}

export namespace classifyPixiMainSceneReconciliation {
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

export namespace classifyPixiMainSceneActorUpdate {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly deliveryRetained: boolean;
		readonly directLanding: boolean;
		readonly displayItem: TileActorItem;
		readonly motionClaimed: boolean;
		readonly pose: PixiTileActorPose;
		readonly poseChannelActive: boolean;
		readonly preserveVisual: boolean;
	}
}

const isSameMainSceneVisual = (left: TileActorItem, right: TileActorItem) => {
	if (left.revision !== right.revision) return false;
	if (left.primaryAction.kind !== right.primaryAction.kind) return false;
	if (
		left.primaryAction.kind === "enqueue-default-line" &&
		(right.primaryAction.kind !== "enqueue-default-line" ||
			left.primaryAction.lineId !== right.primaryAction.lineId)
	)
		return false;
	return (
		left.activityEffect === right.activityEffect &&
		left.badgeCount === right.badgeCount &&
		left.badgeKind === right.badgeKind &&
		left.compositeUrl === right.compositeUrl &&
		left.quantity === right.quantity &&
		left.running === right.running &&
		left.sourceUrl === right.sourceUrl &&
		left.title === right.title
	);
};

export const classifyPixiMainSceneActorUpdate = ({
	actor,
	deliveryRetained,
	directLanding,
	displayItem,
	motionClaimed,
	pose,
	poseChannelActive,
	preserveVisual,
}: classifyPixiMainSceneActorUpdate.Props): PixiMainSceneActorUpdatePlan => {
	const moved = !isSameTileActorLocation(actor.item.location, displayItem.location);
	const visualChanged = !isSameMainSceneVisual(actor.currentVisual.item, displayItem);
	const progressChanged = actor.item.progressRatio !== displayItem.progressRatio;
	const sizeChanged = actor.size !== pose.size;
	const poseOwned = actor.dragging || deliveryRetained || motionClaimed || poseChannelActive;
	const nextCrowdAlpha = readPixiTileActorCrowdAlpha(displayItem);
	const crowdAlpha =
		readPixiTileActorCrowdAlpha(actor.item) === nextCrowdAlpha ? null : nextCrowdAlpha;
	const activityEffect =
		actor.item.activityEffect === displayItem.activityEffect
			? null
			: displayItem.activityEffect
				? "start"
				: "stop";
	const previousDisplayedSize = actor.size * actor.container.scale.x;
	const item: PixiMainSceneActorUpdatePlan["item"] =
		visualChanged || sizeChanged
			? {
					kind: "visual",
					preserveVisual,
					size: poseOwned ? actor.size : pose.size,
				}
			: progressChanged
				? {
						kind: "progress",
					}
				: {
						kind: "assign",
					};
	if (poseOwned) {
		return {
			activityEffect,
			crowdAlpha,
			item,
			pose: {
				kind: "owned",
			},
		};
	}
	const needsTravel =
		moved || actor.container.x !== pose.x || actor.container.y !== pose.y || sizeChanged;
	return {
		activityEffect,
		crowdAlpha,
		item,
		pose: needsTravel
			? {
					directLanding,
					kind: "travel",
					scaleBeforeTravel: sizeChanged
						? previousDisplayedSize / Math.max(1, pose.size)
						: null,
				}
			: {
					kind: "place",
				},
	};
};

/**
 * Classifies one fully-read presentation snapshot without mutating retained actors or allocating
 * visual generations. The reconciler remains the sole owner that applies this ordered plan.
 */
export const classifyPixiMainSceneReconciliation = ({
	actorIds,
	deliveryRetainedActorIds,
	feedbackCues,
	hiddenActorIds,
	inventoryActorIds,
	motionRetainedActorIds,
	pendingActorIds,
	visibleActors,
}: classifyPixiMainSceneReconciliation.Props): PixiMainSceneReconciliationPlan => {
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
};
